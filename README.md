# @clawhelp/fmlhealth-cli

一家检 - 家庭健康管理命令行工具。供 AI Agent（openclaw 等）通过终端调用。

## 安装

```bash
npm install -g @clawhelp/fmlhealth-cli
```

## 使用

```bash
fmlhealth-cli members                        # 列出家庭成员
fmlhealth-cli health <姓名>                  # 健康摘要
fmlhealth-cli tests <姓名> [指标名]          # 自测记录
fmlhealth-cli test-add <姓名> <指标名> <数值> [舒张压]  # 录入自测
fmlhealth-cli test-delete <姓名> <指标名> [条数]  # 删除自测(默认1条)
fmlhealth-cli trend <姓名> <指标名>          # 趋势分析
fmlhealth-cli checkin [姓名]                 # 打卡状态
fmlhealth-cli analyze <姓名>                 # 健康分析
fmlhealth-cli auth login                     # 授权登录
fmlhealth-cli +me                            # 查看当前身份
```

所有命令返回 JSON。

## 授权

首次使用需执行 `fmlhealth-cli auth login`，扫码完成授权。

## License

MIT
