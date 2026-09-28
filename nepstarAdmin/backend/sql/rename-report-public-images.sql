-- Rename references to the report frontend's English-named public assets.
-- Run only against the nepstar schema. URLs keep their existing host and path.
START TRANSACTION;

UPDATE sa_product
SET cover_url = REPLACE(
    REPLACE(cover_url, '睡眠健康管理方案.png', 'sleep-health-management-plan.png'),
    '/sleep-health-management-plan.png', '/assets/sleep-health-management-plan.png'
)
WHERE product_name = '睡眠健康管理礼盒'
  AND cover_url NOT LIKE '%/assets/sleep-health-management-plan.png'
  AND (cover_url LIKE '%睡眠健康管理方案.png' OR cover_url LIKE '%/sleep-health-management-plan.png');

UPDATE sa_product
SET cover_url = REPLACE(
    REPLACE(cover_url, '钙流失健康管理方案.png', 'calcium-loss-health-management-plan.png'),
    '/calcium-loss-health-management-plan.png', '/assets/calcium-loss-health-management-plan.png'
)
WHERE product_name = '钙流失健康管理礼盒'
  AND cover_url NOT LIKE '%/assets/calcium-loss-health-management-plan.png'
  AND (cover_url LIKE '%钙流失健康管理方案.png' OR cover_url LIKE '%/calcium-loss-health-management-plan.png');

UPDATE sa_product_image pi
JOIN sa_product p ON p.id = pi.product_id
SET pi.image_url = REPLACE(
    REPLACE(pi.image_url, '睡眠健康管理方案.png', 'sleep-health-management-plan.png'),
    '/sleep-health-management-plan.png', '/assets/sleep-health-management-plan.png'
)
WHERE p.product_name = '睡眠健康管理礼盒'
  AND pi.image_url NOT LIKE '%/assets/sleep-health-management-plan.png'
  AND (pi.image_url LIKE '%睡眠健康管理方案.png' OR pi.image_url LIKE '%/sleep-health-management-plan.png');

UPDATE sa_product_image pi
JOIN sa_product p ON p.id = pi.product_id
SET pi.image_url = REPLACE(
    REPLACE(pi.image_url, '钙流失健康管理方案.png', 'calcium-loss-health-management-plan.png'),
    '/calcium-loss-health-management-plan.png', '/assets/calcium-loss-health-management-plan.png'
)
WHERE p.product_name = '钙流失健康管理礼盒'
  AND pi.image_url NOT LIKE '%/assets/calcium-loss-health-management-plan.png'
  AND (pi.image_url LIKE '%钙流失健康管理方案.png' OR pi.image_url LIKE '%/calcium-loss-health-management-plan.png');

COMMIT;
