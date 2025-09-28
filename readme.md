# 1. Prisma Schema 设计文档
## 概览 / Overview
- **数据库**：PostgreSQL  
- **客户端**：`prisma-client-js`  
- **核心领域**：用户、会员、邀请、赛事、参赛记录、榜单快照  
- **合规/风控**：年龄分组、活体校验标记、仅市级定位、手机号等隐私加密（应用层 AES）

---

## 模型与字段 / Models
### `User`（用户）
### `Referral`（邀请关系）
### `Membership`（会员）
### `Contest`（赛事）
### `ContestEntry`（参赛记录）
### `Leaderboard`（榜单快照）

---

## 枚举 / Enums

### `AgeGroup`
| 年龄段 (Age Range) | 分组 (Group)       | 参赛 (Participate) | 会员 (Buy Membership) |
|--------------------|--------------------|---------------------|------------------------|
| <12                | BLOCKED_UNDER_12   | ❌                  | ❌                     |
| 12–18              | MINOR_12_18        | ✅                  | ❌                     |
| 19–60              | ADULT              | ✅                  | ✅                     |
| 61–65              | SENIOR_60_65       | ✅                  | ❌                     |
| >65                | SENIOR_65_PLUS     | ❌                  | ❌                     |

### `MembershipTier`
- `NONE`  
- `VIP`  
- `VIP_PLUS`  

### `ContestScope`
- `CITY`  
- `PROVINCE`  
- `DISTRICT`  

### `ContestFreq`
- `DAILY`  
- `WEEKLY`  

---

## 关系图（文字版） / Relations (Text)
- `User (1) — (0..1) Membership`  
- `User (1) — (0..n) Referral (as referrer)`  
- `User (1) — (0..n) Referral (as referee)`  
- `Contest (1) — (0..n) ContestEntry`  
- `User (1) — (0..n) ContestEntry`  
- `Contest (1) — (0..1) Leaderboard`

---

## 设计亮点 / Highlights
- **最小暴露原则**：隐私数据加密存储；城市仅精确到市级  
- **赛事可追溯**：榜单快照与备份，便于仲裁  
- **高性能**：索引覆盖常见查询（邀请、参赛）  
- **合规策略**：年龄分组与参赛/付费规则集中维护 

---

# 2. 中间件
## 速率限制
- 这是一个基于 Redis 的限流器，可以限制某个 IP 在 windowSec 秒内最多请求 limit 次。超出就拒绝，返回 429。

| 接口类型 (API Type) | 前缀 (Prefix) | 限制次数 (Limit) | 时间窗口 (WindowSec) | 效果说明 (Effect) |
|----------------------|---------------|------------------|----------------------|-------------------|
| 登录接口 (Login)     | `auth`        | 30 次            | 60 秒                | 防止暴力破解或机器人不停尝试登录 |
| 用户资料更新 (Profile Update) | `user` | 120 次           | 60 秒                | 避免用户高频恶意修改资料 |
| 参赛提交 (Contest Join) | `contest`  | 120 次           | 60 秒                | 控制提交频率，防止刷步数接口 |
| 排行榜查询 (Leaderboard) | `board`  | 120 次           | 60 秒                | 避免短时间频繁刷新排行榜 |
| 推荐绑定 (Referral) | `ref`          | 60 次            | 60 秒                | 限制邀请接口，避免刷邀请 |
| 会员购买 (Membership) | `member`     | 30 次            | 60 秒                | 防止恶意刷支付接口 |

---

# 3. 实用功能
## 根据出生日期，计算用户年龄，并划分到不同年龄组，决定是否允许参赛和购买会员。

| 年龄段 (Age Range) | 分组 (Group)       | 参赛 (Participate) | 会员 (Buy Membership) |
|--------------------|--------------------|---------------------|------------------------|
| <12                | BLOCKED_UNDER_12   | ❌                  | ❌                     |
| 12–18              | MINOR_12_18        | ✅                  | ❌                     |
| 19–60              | ADULT              | ✅                  | ✅                     |
| 61–65              | SENIOR_60_65       | ✅                  | ❌                     |
| >65                | SENIOR_65_PLUS     | ❌                  | ❌                     |

---

## 时间线
- **06:00–20:00** → 正常统计数据。
- **22:00–06:00** → 夜间禁止统计。
- **20:00–22:00** → 过渡时间，不统计，也不算夜间。

| 时间段 (Time Range) | 状态 (Status)        | isWithinValidCollectWindow | isNightQuiet |
|---------------------|----------------------|-----------------------------|--------------|
| 00:00 – 05:59       | 夜间休眠 (Night Quiet) | ❌                          | ✅           |
| 06:00 – 19:59       | 有效统计 (Collect OK) | ✅                          | ❌           |
| 20:00 – 21:59       | 非统计时段 (Not Collected) | ❌                          | ❌           |
| 22:00 – 23:59       | 夜间休眠 (Night Quiet) | ❌                          | ✅           |