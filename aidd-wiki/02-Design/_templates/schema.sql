-- project: proj-analysis-learner
-- module: <module>
-- revision: 001
-- dialect: mysql
-- standards: 02-Design/standards/ddl.md

-- ENT-001 / F-001
CREATE TABLE `t_example` (
  `id` bigint NOT NULL COMMENT '主键ID',
  `name` varchar(100) NOT NULL COMMENT '名称',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `create_user` bigint DEFAULT NULL COMMENT '创建人ID',
  `update_time` datetime DEFAULT NULL COMMENT '更新时间',
  `update_user` bigint DEFAULT NULL COMMENT '更新人ID',
  `deleted` tinyint NOT NULL DEFAULT '0' COMMENT '是否删除（0否 1是）',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='示例表';

CREATE INDEX `idx_example_name` ON `t_example` (`name`);
