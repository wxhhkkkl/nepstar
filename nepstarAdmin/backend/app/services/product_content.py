"""Bounded, inert public product reading content. Never returns raw HTML."""
import re
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit

from ..config import settings

_BLOCKED = {'script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'form', 'video', 'audio', 'template', 'noscript'}
_VOID = {'br', 'img', 'hr', 'input', 'meta', 'link', 'source', 'area', 'base', 'wbr', 'embed', 'param', 'track', 'col'}
_PARAGRAPHS = {'p', 'div', 'section', 'article', 'blockquote', 'tr', 'td'}


def safe_media_url(value) -> str | None:
    if not isinstance(value, str) or not value or len(value) > 2048:
        return None
    value = value.strip()
    decoded = value
    for _ in range(3):
        decoded = unquote(decoded)
    if re.search(r'[\x00-\x20\x7f\\]', decoded) or decoded.startswith('//'):
        return None
    try:
        parsed = urlsplit(value)
        path = unquote(parsed.path).lower()
        if any(part == '..' for part in path.split('/')) or re.search(r'\.(?:svg|html?|xml|js|php)(?:$|;)', path):
            return None
        if value.startswith('/') and not parsed.scheme and not parsed.netloc:
            return value
        if value.startswith('./assets/') and not parsed.scheme and not parsed.netloc:
            return value
        endpoint = settings.OSS_ENDPOINT.strip().rstrip('/')
        host = urlsplit(endpoint if '://' in endpoint else 'https://' + endpoint).hostname if endpoint else None
        allowed = {'nepstar.kangjia.online', 'kj101.jiankangzhan.com'}
        if host and settings.OSS_BUCKET:
            allowed.add(host if host.startswith(settings.OSS_BUCKET + '.') else f'{settings.OSS_BUCKET}.{host}')
        if parsed.scheme in {'http', 'https'} and parsed.hostname in allowed and not parsed.username and not parsed.password and parsed.port in {None, 80, 443}:
            return value
    except (ValueError, TypeError):
        pass
    return None


class _ContentParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.blocks = []
        self.parts = []
        self.heading = None
        self.current_list = None
        self.stack = []
        self.blocked = []
        self.count = 0
        self.truncated = False
        self.halted = False

    def add(self, block):
        if self.count >= 1000:
            self.truncated = self.halted = True
            return
        self.count += 1
        self.blocks.append(block)

    def flush(self):
        text = ''.join(self.parts).strip()
        self.parts = []
        if not text:
            return
        if self.current_list is not None:
            if self.count + len(self.current_list['items']) >= 1000:
                self.truncated = self.halted = True
            else:
                self.current_list['items'].append(text)
        elif self.heading:
            self.add({'type': 'heading', 'level': self.heading, 'text': text})
        else:
            self.add({'type': 'paragraph', 'text': text})

    def finish_list(self):
        self.flush()
        if self.current_list is not None:
            item = self.current_list
            self.current_list = None
            if item['items']:
                self.add(item)
                self.count += len(item['items'])

    def handle_starttag(self, tag, attrs):
        if self.halted:
            return
        if self.blocked:
            if tag not in _VOID:
                self.blocked.append(tag)
                if len(self.blocked) + len(self.stack) > 32:
                    self.truncated = self.halted = True
            return
        if tag in _BLOCKED:
            if tag not in _VOID:
                self.blocked.append(tag)
            return
        if tag not in _VOID:
            self.stack.append(tag)
            if len(self.stack) > 32:
                self.truncated = self.halted = True
                return
        if tag in {'ul', 'ol'}:
            self.finish_list()
            self.current_list = {'type': 'list', 'ordered': tag == 'ol', 'items': []}
        elif tag == 'li':
            self.flush()
        elif tag in _PARAGRAPHS or re.fullmatch('h[1-6]', tag):
            if self.current_list is None:
                self.flush()
                self.heading = min(int(tag[1]), 3) if re.fullmatch('h[1-6]', tag) else None
                if self.heading == 1:
                    self.heading = 2
            else:
                self.parts.append('\n')
        elif tag == 'br':
            self.parts.append('\n')
        elif tag == 'img':
            self.finish_list()
            attributes = dict(attrs)
            url = safe_media_url(attributes.get('src'))
            if url:
                self.add({'type': 'image', 'url': url, 'alt': (attributes.get('alt') or '')[:500]})

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in _VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if self.blocked:
            if tag in self.blocked:
                self.blocked = self.blocked[:len(self.blocked) - 1 - self.blocked[::-1].index(tag)]
            return
        if tag in self.stack:
            self.stack = self.stack[:len(self.stack) - 1 - self.stack[::-1].index(tag)]
        if self.halted:
            return
        if tag in {'ul', 'ol'}:
            self.finish_list()
        elif tag == 'li' or tag in _PARAGRAPHS or re.fullmatch('h[1-6]', tag):
            self.flush()
            self.heading = None

    def handle_data(self, data):
        if not self.blocked and not self.halted:
            self.parts.append(data)


def parse_product_content(html) -> tuple[list[dict], bool]:
    if not isinstance(html, str) or not html.strip():
        return [], False
    parser = _ContentParser()
    parser.feed(html[:100000])
    parser.close()
    parser.finish_list()
    return parser.blocks, parser.truncated or len(html) > 100000
