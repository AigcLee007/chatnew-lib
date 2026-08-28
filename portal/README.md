# ChatVIP version portal

这是 `https://chatvip.aittco.com` 的独立静态入口页。它只介绍和跳转，不嵌入或修改任一聊天应用。

## 域名映射

```text
chatvip.aittco.com/         -> 本目录静态选择页
chatvip.aittco.com/main/    -> D:\chatvip.aittco.com\chatvip-ai-chat-main（经典版）
chat.aittco.com/            -> D:\chat-libre\LibreChat（新版）
```

## 本地预览

在仓库根目录运行：

```powershell
npx serve portal -l 4173
```

然后打开 `http://127.0.0.1:4173`。页面跳转目标是生产 HTTPS 地址，点击前请确认目标服务已经部署。

## 上线前检查

1. 为 `chatvip.aittco.com`、`chat.aittco.com` 创建 DNS A 记录并申请 HTTPS 证书。
2. 经典版生产构建需使用 `base=/main/`，再由 Nginx 将 `/main/` 代理到经典版服务。
3. 让 Nginx 的 `chatvip.aittco.com` 根路径提供本目录，并将 `/api/` 代理到经典版 API。
4. 从外部浏览器确认选择页、`/main/` 经典版和新版均可访问、登录和流式输出正常。

## 回滚

恢复 `chatvip.aittco.com` 原来的 document root 或 server block 即可。两个目标域名保持独立运行，不需要回滚聊天服务。
