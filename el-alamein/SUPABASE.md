# El Alamein Supabase Online Setup

第一版联机使用 Supabase 房间码同步整局 `GameState`。不填配置时仍是本地 hotseat。

## 你需要做的事

1. 在 Supabase 新建一个 project。
2. 打开 Supabase SQL Editor，运行 `el-alamein/supabase/schema.sql`。
3. 在 Project Settings -> API 里复制 Project URL 和 anon public key。
4. 打开游戏里的 `设置 / Setup`，粘贴 Project URL 和 anon public key，然后点 `保存 / Save`。

也可以手动把 `el-alamein/supabase-config.example.js` 的内容复制到 `el-alamein/supabase-config.js`，填入：

```js
window.EL_ALAMEIN_SUPABASE = {
  url: "https://YOUR-PROJECT.supabase.co",
  anonKey: "YOUR-SUPABASE-ANON-KEY",
};
```

## 使用方式

1. 打开 `el-alamein/` 页面。
2. 点 `设置 / Setup`，保存配置；也可以点 `复制建表 SQL / Copy SQL`。
3. 点 `创建 / Create`，得到房间码。
4. 一个玩家点 `轴心 / Axis`，另一个玩家用同一个房间码加入后点 `英军 / Allied`。
5. 当前阶段所属阵营才能移动、宣告战斗、结算、撤退、挺进和结束阶段。

## 说明

这个版本适合朋友之间联机。客户端会用版本号避免同时写入覆盖，但规则校验仍在浏览器端。公开给陌生人玩之前，建议再加 Supabase RPC 或 Edge Function 做服务器端规则校验和骰子结算。
