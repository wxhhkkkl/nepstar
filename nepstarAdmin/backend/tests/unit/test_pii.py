"""Unit tests for PII masking utilities."""

import pytest
from app.utils.pii import mask_phone, mask_name


class TestMaskPhone:
    """Test mask_phone() function."""

    def test_standard_mobile(self):
        """标准11位手机号：前3后4，中间****。"""
        assert mask_phone("13812345678") == "138****5678"

    def test_short_phone(self):
        """短号码（<7位）：保留首字符，其余****。"""
        assert mask_phone("1381234") == "1****"

    def test_exactly_7_digits(self):
        """恰好7位：前3后4，中间****（0个真实数字被替换）。"""
        assert mask_phone("1234567") == "123****4567"

    def test_none_input(self):
        """None 输入返回 None。"""
        assert mask_phone(None) is None

    def test_empty_string(self):
        """空字符串返回空字符串。"""
        assert mask_phone("") == ""

    def test_international_number(self):
        """国际号码也同样处理。"""
        assert mask_phone("+8613812345678") == "+86****5678"


class TestMaskName:
    """Test mask_name() function."""

    def test_chinese_name_two_chars(self):
        """中文两字名：张*。"""
        assert mask_name("张三") == "张*"

    def test_chinese_name_three_chars(self):
        """中文三字名：李**。"""
        assert mask_name("李小明") == "李**"

    def test_english_name(self):
        """英文名：首字母保留，其余*。"""
        assert mask_name("Li Xiaoming") == "L*********"

    def test_single_char(self):
        """单字名：保留原字。"""
        assert mask_name("A") == "A"

    def test_none_input(self):
        """None 输入返回 None。"""
        assert mask_name(None) is None

    def test_empty_string(self):
        """空字符串返回空字符串。"""
        assert mask_name("") == ""
