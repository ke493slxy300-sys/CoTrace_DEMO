# CoTrace 真实模型 Demo 材料包
沿用已有 CoTrace 方案中的角色、订单服务和交付版本设定。资料库搜索未确认到可直接复用的原始代码、导出日志和运行记录，因此这里提供独立的合成测试夹具。代码可运行，但只覆盖演示所需的服务函数。对话和师生发言为模拟材料，测试日志为对本包代码真实执行所得。

服务端按 manifest.json 读取材料正文，文件引用使用材料 ID。JSONL 每行一个事件，Codex 样例只模拟 CLI 的事件输出，用户输入另外配套。Cursor 样例模拟 Markdown 导出，具体标题排版属于本包约定。验收答案 QA.md 和教师反馈台词不得提前进入模型输入。review-and-help.json 中的文本按角色手动提交。

格式参考
- [Cursor Chat History](https://docs.cursor.com/en/agent/chat/history)
- [Codex CLI JSONL](https://learn.chatgpt.com/docs/non-interactive-mode)
