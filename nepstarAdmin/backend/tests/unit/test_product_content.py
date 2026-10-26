"""Untrusted maintained product HTML becomes inert, bounded reading blocks."""
import pytest


def parse(html):
    from app.services.product_content import parse_product_content
    return parse_product_content(html)


def test_preserves_paragraphs_headings_lists_and_valid_images_only():
    blocks, truncated = parse('<h1>原始标题</h1><p>原文<strong>说明</strong></p><ul><li>第一项</li><li>第二项</li></ul><img src="/assets/a.png" alt="原图">')
    assert blocks == [
        {'type': 'heading', 'level': 2, 'text': '原始标题'},
        {'type': 'paragraph', 'text': '原文说明'},
        {'type': 'list', 'ordered': False, 'items': ['第一项', '第二项']},
        {'type': 'image', 'url': '/assets/a.png', 'alt': '原图'},
    ]
    assert not truncated


@pytest.mark.parametrize('source', ['javascript:alert(1)', '//evil.test/a.png', 'https://evil.test/a.png',
                                  'data:image/svg+xml,evil', '/%5cevil.test/a.png', '/assets/x.svg'])
def test_unsafe_images_never_reach_browser(source):
    blocks, _ = parse(f'<img src="{source}" onerror="alert(1)"><script>private()</script><style>hidden</style><form><p>bad</p></form><p>可读</p>')
    assert blocks == [{'type': 'paragraph', 'text': '可读'}]


def test_empty_and_malformed_active_content_do_not_create_an_expansion():
    assert parse('<p> </p><script>run()')[0] == []
    assert parse(None) == ([], False)
    assert parse('<div>原文<br>下一行')[0] == [{'type': 'paragraph', 'text': '原文\n下一行'}]


def test_limits_are_explicit_and_do_not_fall_back_to_html():
    blocks, truncated = parse('<div>' * 40 + 'deep' + '</div>' * 40)
    assert truncated
    blocks, truncated = parse('<p>' + '甲' * 110000 + '</p>')
    assert truncated and len(str(blocks)) < 101000
    assert parse('<p>甲</p>' * 1100)[1]


def test_only_explicit_public_resource_hosts_are_accepted(monkeypatch):
    from app.services.product_content import safe_media_url
    from app.config import settings
    monkeypatch.setattr(settings, 'OSS_BUCKET', 'catalog')
    monkeypatch.setattr(settings, 'OSS_ENDPOINT', 'oss-cn-test.aliyuncs.com')
    assert safe_media_url('https://catalog.oss-cn-test.aliyuncs.com/a.jpg')
    assert not safe_media_url('https://other.oss-cn-test.aliyuncs.com/a.jpg')
    assert not safe_media_url('https://nepstar.kangjia.online@evil.test/a.jpg')
