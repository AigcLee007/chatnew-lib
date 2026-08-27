# ChatVIP version portal

这是 `https://chatvip.aittco.com` 的独立静态入口页。它只介绍和跳转，不嵌入或修改任一聊天应用。

## 域名映射

```text
chatvip.aittco.com          -> 本目录静态文件
chat.aittco.com              -> D:\chat-libre\LibreChat（新版）
chatvvip.aittco.com          -> D:\chatvip.aittco.com\chatvip-ai-chat-main（经典版）
```

## 本地预览

在仓库根目录运行：

```powershell
npx serve portal -l 4173
```

然后打开 `http://127.0.0.1:4173`。页面跳转目标是生产 HTTPS 地址，点击前请确认目标服务已经部署。

## 上线前检查

1. 为三个域名创建 DNS A 记录并申请覆盖三个域名的 HTTPS 证书。
2. 先独立确认 `https://chat.aittco.com` 和 `https://chatvvip.aittco.com` 可访问、登录和流式输出正常。
3. 让 Nginx 根域名指向本目录，不要覆盖两个聊天服务的端口或数据卷。
4. 从外部浏览器点击两个 CTA，确认地址分别为新版和经典版。

## 回滚

恢复 `chatvip.aittco.com` 原来的 document root 或 server block 即可。两个目标域名保持独立运行，不需要回滚聊天服务。
