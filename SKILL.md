# 一家检 - 家庭健康管理

## 触发条件

当用户表达以下任一意图时，必须使用 fmlhealth-cli：
- 查询家庭成员信息
- 查询或录入健康数据（血压、血糖、体重、心率、体温等）
- 查询健康指标趋势
- 查看打卡状态
- 进行健康分析
- 安装/授权一家检服务

判断标准：用户提到"健康"、"体检"、"血压"、"血糖"、"体重"、"家人"、"打卡"、"趋势"、"分析"等关键词，或询问家庭成员的健康数据时，使用本工具。

## 功能描述

一家检是家庭健康管理系统，可管理家庭成员的健康数据。

你是通过终端执行 `fmlhealth-cli` 命令与一家检交互的 AI Agent。

## 可用命令

所有命令返回 JSON 格式结果，你需要解析后用自然语言回复用户。

### 查询类

```bash
fmlhealth-cli members                      # 列出所有家庭成员（姓名、关系、年龄、性别）
fmlhealth-cli health <姓名>               # 健康摘要（血型、过敏史、紧急联系人）
fmlhealth-cli tests <姓名> [指标名]       # 查看自测记录，可选按指标名筛选
fmlhealth-cli trend <姓名> <指标名>       # 指标趋势分析（均值、方向、最新值）
fmlhealth-cli checkin                     # 所有成员的打卡状态
fmlhealth-cli checkin <姓名>              # 特定成员的打卡状态
fmlhealth-cli analyze <姓名>             # 整体健康状况（异常指标、报告日期）
```

### 录入类

```bash
fmlhealth-cli test-add <姓名> <指标名> <数值>              # 添加自测
fmlhealth-cli test-add <姓名> 血压 <收缩压> <舒张压>      # 添加血压（需两个值）
fmlhealth-cli test-delete <姓名> <指标名> [条数]          # 删除最近 N 条自测（默认 1 条）
```

### 认证类
```bash
fmlhealth-cli auth login      # 支付宝授权登录
fmlhealth-cli +me             # 查看当前登录身份
```

## 使用场景

### 1. 查看家庭信息
用户说"我家有哪些人" → 执行 `fmlhealth-cli members`，然后回复

### 2. 查看自测数据
用户说"sbc最近的血压怎么样" → 先执行 `fmlhealth-cli trend sbc 收缩压`，然后回复趋势

### 3. 录入数据
用户说"帮我记一下血压 135/88" → 如果没说是谁，先问"为哪位成员记录？"；知道成员后执行 `fmlhealth-cli test-add sbc 血压 135 88`

### 4. 查看打卡
用户说"今天大家都打卡了吗" → 执行 `fmlhealth-cli checkin`，回复打卡状态

### 5. 健康分析
用户说"分析sbc健康状况" → 执行 `fmlhealth-cli analyze sbc`，回复异常指标

## 初次使用

如果用户还没安装 fmlhealth-cli：
```bash
npm install -g @clawhelp/fmlhealth-cli
```

如果用户还没授权：
```bash
fmlhealth-cli auth login
# 然后告诉用户点击输出的链接完成支付宝授权
# 授权完成后执行 fmlhealth-cli +me 验证
```

## 注意事项

- 所有命令返回 JSON。解析后用中文自然语言回复用户
- 血压需要同时提供收缩压和舒张压
- 若用户未指定姓名，先询问。列出成员让用户选择。
- 数值要保留适当的小数位，不要自行四舍五入
- 指标名支持别名自动转换（如"餐后2h血糖"→"餐后2小时血糖"），也支持模糊匹配
- 新增指标名会要求用户二次确认，不要跳过
