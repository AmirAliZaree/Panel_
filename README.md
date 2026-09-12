# AMIRALI CONFIG PANEL V1

پنل شخصی برای خواندن اطلاعات کاربران از 3x-ui/ثنایی از طریق Backend.

## اجرا

1. فایل `.env.example` را به `.env` تغییر نام بده.
2. این موارد را تنظیم کن:
   - `XUI_BASE_URL`
   - `XUI_USERNAME`
   - `XUI_PASSWORD`
   - `XUI_PANEL_PATH`
   - `PUBLIC_BASE_URL`
   - `SUB_SECRET`
3. اجرا:
   ```bash
   npm install
   npm start
   ```

## Railway

Repository را به Railway وصل کن. Railway به‌صورت خودکار با `npm start` اجرا می‌کند.
Environment Variables را در Railway وارد کن.

## نکته مهم درباره Subscription

این V1 اتصال Backend و دریافت فهرست کاربران را آماده می‌کند، اما برای تولید URI واقعی Subscription باید فرمت دقیق هر inbound (VLESS/VMess/Trojan، TLS/Reality، WS/gRPC، path/host/SNI و public host) از ساختار پنل خوانده شود.

فایل `src/subscription.js` محل تولید خروجی Subscription است. عمداً از حدس‌زدن URI و ساختن کانفیگ ناقص خودداری شده است.
