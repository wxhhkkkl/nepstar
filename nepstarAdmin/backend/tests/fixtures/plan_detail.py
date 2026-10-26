"""Synthetic public DTO, not a production default or a database record."""
PLAN_DETAIL = {
    'report_code': 'R1', 'plan': {'plan_id': 17, 'name': '测试睡眠方案', 'description': '维护说明'},
    'primary_indicator': {'system_code': 'SYS_BONE', 'system_name': '骨骼',
                          'indicator_code': 'SYS_BONE_OSTEO', 'indicator_name': '骨质疏松',
                          'indicator_score': 98, 'trigger_score_below': 99},
    'related_indicators': [], 'products': [],
    'consult': {'status': 'unavailable', 'message': '暂不可用'},
}
PLAN_DETAIL['related_indicators'] = [dict(PLAN_DETAIL['primary_indicator'])]
