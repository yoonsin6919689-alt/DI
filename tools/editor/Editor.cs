using System;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace DimensionEditor
{
    internal static class Theme
    {
        public static readonly Color Bg = ColorTranslator.FromHtml("#07080B");
        public static readonly Color Panel = ColorTranslator.FromHtml("#0F1218");
        public static readonly Color PanelAlt = ColorTranslator.FromHtml("#121722");
        public static readonly Color Field = ColorTranslator.FromHtml("#151B24");
        public static readonly Color Border = ColorTranslator.FromHtml("#242C3A");
        public static readonly Color Accent = ColorTranslator.FromHtml("#E2B45F");
        public static readonly Color Text = ColorTranslator.FromHtml("#F1ECE2");
        public static readonly Color Muted = ColorTranslator.FromHtml("#98A0AD");
        public static readonly Color Ok = ColorTranslator.FromHtml("#7ED9A4");
        public static readonly Color Danger = ColorTranslator.FromHtml("#E06C75");
        public static readonly Color Select = ColorTranslator.FromHtml("#26303F");

        public static Font Body()
        {
            return new Font("Malgun Gothic", 9.5f, FontStyle.Regular, GraphicsUnit.Point);
        }

        public static Font Bold(float size)
        {
            return new Font("Malgun Gothic", size, FontStyle.Bold, GraphicsUnit.Point);
        }

        public static Font Small()
        {
            return new Font("Malgun Gothic", 8.5f, FontStyle.Regular, GraphicsUnit.Point);
        }

        public static Font Title()
        {
            return new Font("Malgun Gothic", 15f, FontStyle.Bold, GraphicsUnit.Point);
        }
    }

    internal sealed class EditorException : Exception
    {
        public readonly string Code;

        public EditorException(string code) : base(code)
        {
            Code = code;
        }
    }

    internal sealed class WorldCard
    {
        public string Icon = "Sparkles";
        public string Title = "";
        public string Text = "";
    }

    internal sealed class EventPhoto
    {
        public byte[] Bytes;
        public string ContentType;
        public string UploadedPath = "";
    }

    internal sealed class EventBlock
    {
        public string Type = "text";
        public string Text = "";
        public string ImagePath = "";
        public string Caption = "";
        // Preview URLs refer to the saved index, not the current draft order.
        public string PreviewUrl = "";
        public EventPhoto Photo;

        public EventBlock Copy()
        {
            return (EventBlock)MemberwiseClone();
        }

        public override string ToString()
        {
            string text = Type == "image" ? Caption : Text;
            text = text.Replace("\r", " ").Replace("\n", " ");
            if (text.Length > 45) text = text.Substring(0, 45) + "…";
            return (Type == "image" ? "사진 · " : "텍스트 · ") + text;
        }
    }

    internal sealed class EventEntry
    {
        public string Id = "";
        public string Title = "";
        public string ThumbnailPath = "";
        public string CreatedAt = "";
        public string UpdatedAt = "";
        public string ThumbnailUrl = "";
        public EventPhoto ThumbnailPhoto;
        public List<EventBlock> Blocks = new List<EventBlock>();

        public EventEntry Copy()
        {
            EventEntry copy = (EventEntry)MemberwiseClone();
            copy.Blocks = new List<EventBlock>();
            foreach (EventBlock block in Blocks) copy.Blocks.Add(block.Copy());
            return copy;
        }

        public override string ToString()
        {
            return Title;
        }
    }

    internal sealed class Member
    {
        public string Id = "";
        public string Username = "";
        public string Nickname = "";
        public string Role = "user";
        public string Status = "active";
        public string SanctionUntil = "";
        public string SanctionReason = "";
        public string CreatedAt = "";
        public string Email = "";
        public bool Verified;
        public bool EmailConsent = true;

        public bool IsAdmin()
        {
            return Role == "admin";
        }

        public string EmailText()
        {
            if (Email.Length == 0) return "이메일 미등록";
            return EmailConsent ? Email : Email + " · 수신 거부";
        }
    }

    internal static class Messages
    {
        private static readonly Dictionary<string, string> Map = new Dictionary<string, string>
        {
            { "network_error", "사이트에 연결하지 못했습니다. 주소와 네트워크를 확인해 주세요." },
            { "invalid_response", "서버가 예상하지 못한 응답을 보냈습니다." },
            { "sites_gateway_origin_forbidden", "이전 버전 편집기입니다. 사이트에서 최신 편집기(v2.3)를 다시 받아 실행해 주세요." },
            { "sites_gateway_login_required", "사이트 접근 권한이 필요합니다. 최신 편집기를 다시 받아 실행해 주세요." },
            { "origin_forbidden", "요청 출처를 확인할 수 없습니다. 최신 편집기를 다시 받아 실행해 주세요." },
            { "invalid_credentials", "아이디 또는 비밀번호가 올바르지 않습니다." },
            { "login_required", "로그인이 만료되었습니다. 다시 로그인해 주세요." },
            { "forbidden", "관리자 권한이 있는 계정만 사용할 수 있습니다." },
            { "rate_limited", "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
            { "invalid_password", "비밀번호를 확인해 주세요." },
            { "invalid_username", "아이디 형식을 확인해 주세요." },
            { "invalid_input", "입력 값을 확인해 주세요." },
            { "invalid_key", "지원하지 않는 설정 항목입니다." },
            { "payload_too_large", "입력 내용이 너무 깁니다." },
            { "service_unavailable", "서비스가 잠시 불안정합니다. 잠시 후 다시 시도해 주세요." },
            { "database_unavailable", "데이터베이스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." },
            { "limiter_busy", "요청이 몰리고 있습니다. 잠시 후 다시 시도해 주세요." },
            { "not_found", "요청한 내용을 찾을 수 없습니다." },
            { "cannot_change_own_role", "자신의 권한은 변경할 수 없습니다." },
            { "cannot_sanction_self", "자신에게는 제재를 적용할 수 없습니다." },
            { "cannot_sanction_admin", "관리자 계정은 제재할 수 없습니다. 먼저 권한을 해제해 주세요." },
            { "account_suspended", "정지된 계정입니다. 관리자에게 문의해 주세요." },
            { "account_restricted", "이용이 제한된 계정입니다. 관리자에게 문의해 주세요." },
            { "invalid_email", "이메일 주소를 확인해 주세요." },
            { "email_taken", "이미 가입된 이메일입니다." },
            { "mail_not_configured", "메일 릴레이가 설정되지 않았습니다. 릴레이 주소와 토큰을 먼저 저장해 주세요." },
            { "mail_failed", "메일을 보내지 못했습니다. 릴레이 설정을 확인해 주세요." },
            { "no_recipients", "메일을 받을 회원이 없습니다. 이메일과 수신 동의를 확인해 주세요." },
            { "event_title", "이벤트 제목은 1~120자로 입력해 주세요." },
            { "event_thumbnail", "별도의 썸네일 사진을 선택해 주세요." },
            { "event_blocks", "본문은 1~24개 블록, 사진은 최대 8개로 구성해 주세요." },
            { "event_text", "본문 텍스트와 사진 설명의 합계는 8,000자까지입니다." },
            { "event_empty_text", "빈 텍스트 블록에 글을 입력하거나 해당 블록을 삭제해 주세요." },
            { "event_photo", "사진을 확인해 주세요. 이 편집기는 PNG/JPEG, 최대 6 MiB를 지원합니다." },
            { "photo_too_large", "사진 크기는 최대 6 MiB이며 서버 업로드 한도를 넘을 수 없습니다." },
            { "photo_upload_failed", "사진을 업로드하지 못했습니다. 초안은 유지됩니다. 다시 저장해 주세요." },
        };

        public static string For(EditorException error)
        {
            string text;
            if (Map.TryGetValue(error.Code ?? "", out text)) return text;
            string code = error.Code ?? "";
            if (code.StartsWith("http_", StringComparison.Ordinal))
            {
                return "서버가 요청을 거부했습니다. (" + code.Substring(5) + ") 최신 편집기를 다시 받아 주세요.";
            }
            return "요청을 처리하지 못했습니다. (" + code + ")";
        }
    }

    internal static class Session
    {
        private static string FilePath
        {
            get
            {
                string dir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "DIMENSION");
                return Path.Combine(dir, "editor-session.txt");
            }
        }

        public static void Save(string site, string token, string username)
        {
            try
            {
                string dir = Path.GetDirectoryName(FilePath);
                if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
                File.WriteAllLines(
                    FilePath,
                    new string[] { site ?? "", token ?? "", username ?? "" },
                    Encoding.UTF8);
            }
            catch
            {
                // Saving the session is a convenience; failure keeps the login working.
            }
        }

        public static void Clear()
        {
            try { File.Delete(FilePath); } catch { }
        }

        public static string LoadSite()
        {
            string[] lines = Read();
            return lines.Length > 0 ? lines[0] : "";
        }

        public static string LoadToken()
        {
            string[] lines = Read();
            return lines.Length > 1 ? lines[1] : "";
        }

        public static string LoadUsername()
        {
            string[] lines = Read();
            return lines.Length > 2 ? lines[2] : "";
        }

        private static string[] Read()
        {
            try
            {
                if (!File.Exists(FilePath)) return new string[0];
                string[] lines = File.ReadAllLines(FilePath, Encoding.UTF8);
                if (lines.Length > 3) Array.Resize(ref lines, 3);
                return lines;
            }
            catch
            {
                return new string[0];
            }
        }
    }

    internal sealed class EditorApi
    {
        private readonly JavaScriptSerializer serializer = new JavaScriptSerializer();
        public string BaseUrl;
        public string Token = "";
        public string LastUsername = "";

        public EditorApi(string baseUrl)
        {
            BaseUrl = Normalize(baseUrl);
        }

        public static string Normalize(string url)
        {
            string value = (url ?? "").Trim();
            if (value.Length == 0) return "";
            if (!value.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
                && !value.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                value = "https://" + value;
            }
            return value.TrimEnd('/');
        }

        public string Login(string username, string password)
        {
            Dictionary<string, object> payload = new Dictionary<string, object>();
            payload["username"] = username;
            payload["password"] = password;
            Dictionary<string, object> data = Send("/api/editor/login", "POST", payload, 20000);
            if (data == null || !data.ContainsKey("token") || !(data["token"] is string))
            {
                throw new EditorException("invalid_response");
            }
            Token = (string)data["token"];
            LastUsername = Username(data);
            return Nickname(data);
        }

        public Dictionary<string, object> Content()
        {
            Dictionary<string, object> data = Send("/api/editor/content", "GET", null, 20000);
            if (data == null || !data.ContainsKey("config")) throw new EditorException("invalid_response");
            return data;
        }

        public Dictionary<string, object> Save(Dictionary<string, string> values)
        {
            Dictionary<string, object> payload = new Dictionary<string, object>();
            payload["values"] = values;
            Dictionary<string, object> data = Send("/api/editor/content", "PATCH", payload, 25000);
            if (data == null || !data.ContainsKey("config")) throw new EditorException("invalid_response");
            return data;
        }

        public List<Member> Members()
        {
            Dictionary<string, object> data = Send("/api/admin/users", "GET", null, 20000);
            object raw;
            object[] items = data != null && data.TryGetValue("users", out raw) ? raw as object[] : null;
            if (items == null) throw new EditorException("invalid_response");
            List<Member> result = new List<Member>();
            foreach (object item in items)
            {
                Member member = ToMember(item as Dictionary<string, object>);
                if (member != null) result.Add(member);
            }
            return result;
        }

        public Member UpdateMember(string id, Dictionary<string, object> payload)
        {
            Dictionary<string, object> data = Send("/api/admin/users/" + id, "PATCH", payload, 20000);
            object raw;
            Dictionary<string, object> user = data != null && data.TryGetValue("user", out raw)
                ? raw as Dictionary<string, object>
                : null;
            Member member = ToMember(user);
            if (member == null) throw new EditorException("invalid_response");
            return member;
        }

        public Dictionary<string, object> Mail()
        {
            Dictionary<string, object> data = Send("/api/admin/mail", "GET", null, 20000);
            if (data == null || !data.ContainsKey("history")) throw new EditorException("invalid_response");
            return data;
        }

        public void SaveMailSettings(string relayUrl, string relayToken, string senderAddress)
        {
            Dictionary<string, object> payload = new Dictionary<string, object>();
            payload["relayUrl"] = relayUrl;
            payload["relayToken"] = relayToken;
            payload["senderAddress"] = senderAddress;
            Dictionary<string, object> data = Send("/api/admin/mail/settings", "PATCH", payload, 20000);
            if (data == null || !data.ContainsKey("configured")) throw new EditorException("invalid_response");
        }

        public Dictionary<string, object> SendMail(string subject, string text, string testEmail)
        {
            Dictionary<string, object> payload = new Dictionary<string, object>();
            payload["subject"] = subject;
            payload["text"] = text;
            if (!string.IsNullOrEmpty(testEmail)) payload["testEmail"] = testEmail;
            Dictionary<string, object> data = Send("/api/admin/mail", "POST", payload, 90000);
            if (data == null || !data.ContainsKey("sent")) throw new EditorException("invalid_response");
            return data;
        }

        public List<EventEntry> Events()
        {
            Dictionary<string, object> data = Send("/api/admin/events", "GET", null, 20000);
            object raw;
            object[] items = data != null && data.TryGetValue("events", out raw) ? raw as object[] : null;
            if (items == null) throw new EditorException("invalid_response");
            List<EventEntry> result = new List<EventEntry>();
            foreach (object item in items) result.Add(ToEvent(item as Dictionary<string, object>));
            return result;
        }

        public static void ValidateEvent(EventEntry entry)
        {
            if (entry.Title.Trim().Length == 0 || entry.Title.Length > 120)
                throw new EditorException("event_title");
            if (entry.ThumbnailPath.Length == 0 && entry.ThumbnailPhoto == null)
                throw new EditorException("event_thumbnail");
            if (entry.Blocks.Count < 1 || entry.Blocks.Count > 24)
                throw new EditorException("event_blocks");
            int images = 0;
            int textLength = 0;
            foreach (EventBlock block in entry.Blocks)
            {
                if (block.Type == "text")
                {
                    if (block.Text.Trim().Length == 0) throw new EditorException("event_empty_text");
                    textLength += block.Text.Length;
                }
                else if (block.Type == "image")
                {
                    images += 1;
                    textLength += block.Caption.Length;
                    if (block.ImagePath.Length == 0 && block.Photo == null)
                        throw new EditorException("event_photo");
                }
                else throw new EditorException("event_blocks");
            }
            if (images > 8) throw new EditorException("event_blocks");
            if (textLength > 8000) throw new EditorException("event_text");
        }

        public EventEntry SaveEvent(EventEntry entry)
        {
            ValidateEvent(entry);
            // Cache each successful upload on the draft, even if a later upload/save fails.
            if (entry.ThumbnailPhoto != null)
            {
                if (entry.ThumbnailPhoto.UploadedPath.Length == 0)
                    entry.ThumbnailPhoto.UploadedPath = UploadPhoto(entry.ThumbnailPhoto.Bytes, entry.ThumbnailPhoto.ContentType);
                entry.ThumbnailPath = entry.ThumbnailPhoto.UploadedPath;
            }
            List<Dictionary<string, object>> blocks = new List<Dictionary<string, object>>();
            foreach (EventBlock block in entry.Blocks)
            {
                Dictionary<string, object> item = new Dictionary<string, object>();
                item["type"] = block.Type;
                if (block.Type == "image")
                {
                    if (block.Photo != null)
                    {
                        if (block.Photo.UploadedPath.Length == 0)
                            block.Photo.UploadedPath = UploadPhoto(block.Photo.Bytes, block.Photo.ContentType);
                        block.ImagePath = block.Photo.UploadedPath;
                    }
                    item["imagePath"] = block.ImagePath;
                    item["caption"] = block.Caption;
                }
                else item["text"] = block.Text;
                blocks.Add(item);
            }
            Dictionary<string, object> payload = new Dictionary<string, object>();
            payload["title"] = entry.Title;
            payload["thumbnailPath"] = entry.ThumbnailPath;
            payload["blocks"] = blocks;
            string path = "/api/admin/events";
            if (entry.Id.Length > 0) path += "/" + Uri.EscapeDataString(entry.Id);
            Dictionary<string, object> data = Send(path, entry.Id.Length == 0 ? "POST" : "PATCH", payload, 30000);
            object raw;
            if (data == null || !data.TryGetValue("event", out raw)) throw new EditorException("invalid_response");
            return ToEvent(raw as Dictionary<string, object>);
        }

        public void DeleteEvent(string id)
        {
            Dictionary<string, object> data = Send("/api/admin/events/" + Uri.EscapeDataString(id), "DELETE", null, 20000);
            object ok;
            if (data == null || !data.TryGetValue("ok", out ok) || !(ok is bool) || !(bool)ok)
                throw new EditorException("invalid_response");
        }

        public string UploadPhoto(byte[] bytes, string contentType)
        {
            if (bytes == null || bytes.Length == 0 || bytes.Length > 6 * 1024 * 1024)
                throw new EditorException("photo_too_large");
            if (contentType != "image/png" && contentType != "image/jpeg" && contentType != "image/webp")
                throw new EditorException("event_photo");
            Dictionary<string, object> payload = new Dictionary<string, object>();
            payload["contentType"] = contentType;
            payload["size"] = bytes.Length;
            Dictionary<string, object> data = Send("/api/uploads/photo", "POST", payload, 20000);
            object max;
            long maxBytes;
            if (data == null || !data.TryGetValue("maxBytes", out max)
                || !long.TryParse(Convert.ToString(max, CultureInfo.InvariantCulture), out maxBytes)
                || maxBytes <= 0) throw new EditorException("invalid_response");
            if (bytes.Length > maxBytes) throw new EditorException("photo_too_large");
            string objectPath = ReadString(data, "objectPath");
            string uploadUrl = ReadString(data, "uploadUrl");
            if (objectPath.Length == 0 || uploadUrl.Length == 0) throw new EditorException("invalid_response");
            Uri target;
            if (!Uri.TryCreate(new Uri(BaseUrl + "/"), uploadUrl, out target)
                || (target.Scheme != "https" && target.Scheme != "http") || target.UserInfo.Length > 0)
                throw new EditorException("invalid_response");
            // Do NOT use Send: signed storage URLs must retain their query and never receive the app token.
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create(target);
            request.Method = "PUT";
            request.ContentType = contentType;
            request.ContentLength = bytes.Length;
            request.Timeout = 60000;
            request.ReadWriteTimeout = 60000;
            request.AllowAutoRedirect = false;
            request.Credentials = null;
            try
            {
                using (Stream stream = request.GetRequestStream()) stream.Write(bytes, 0, bytes.Length);
                using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
                {
                    if ((int)response.StatusCode < 200 || (int)response.StatusCode >= 300)
                        throw new EditorException("photo_upload_failed");
                }
            }
            catch (WebException error)
            {
                if (error.Response != null) error.Response.Close();
                throw new EditorException("photo_upload_failed");
            }
            return objectPath;
        }

        private EventEntry ToEvent(Dictionary<string, object> map)
        {
            if (map == null) throw new EditorException("invalid_response");
            EventEntry entry = new EventEntry();
            entry.Id = ReadString(map, "id");
            entry.Title = ReadString(map, "title");
            entry.ThumbnailPath = ReadString(map, "thumbnailPath");
            entry.CreatedAt = ReadString(map, "createdAt");
            entry.UpdatedAt = ReadString(map, "updatedAt");
            object raw;
            object[] blocks = map.TryGetValue("blocks", out raw) ? raw as object[] : null;
            if (entry.Id.Length == 0 || blocks == null) throw new EditorException("invalid_response");
            string prefix = BaseUrl + "/functions/v1/app/api/events/" + Uri.EscapeDataString(entry.Id);
            string version = "?v=" + Uri.EscapeDataString(entry.UpdatedAt);
            entry.ThumbnailUrl = prefix + "/thumbnail" + version;
            for (int index = 0; index < blocks.Length; index += 1)
            {
                Dictionary<string, object> item = blocks[index] as Dictionary<string, object>;
                if (item == null) throw new EditorException("invalid_response");
                EventBlock block = new EventBlock();
                block.Type = ReadString(item, "type");
                if (block.Type == "text") block.Text = ReadString(item, "text");
                else if (block.Type == "image")
                {
                    block.ImagePath = ReadString(item, "imagePath");
                    block.Caption = ReadString(item, "caption");
                    block.PreviewUrl = prefix + "/images/" + index.ToString(CultureInfo.InvariantCulture) + version;
                }
                else throw new EditorException("invalid_response");
                entry.Blocks.Add(block);
            }
            return entry;
        }

        public void Logout()
        {
            try { Send("/api/editor/logout", "POST", null, 8000); }
            catch (EditorException) { }
        }

        public static string Nickname(Dictionary<string, object> data)
        {
            object editorObject;
            if (data != null && data.TryGetValue("editor", out editorObject))
            {
                Dictionary<string, object> editor = editorObject as Dictionary<string, object>;
                object nickname;
                if (editor != null && editor.TryGetValue("nickname", out nickname) && nickname is string
                    && ((string)nickname).Length > 0)
                {
                    return (string)nickname;
                }
            }
            return "관리자";
        }

        public static string Username(Dictionary<string, object> data)
        {
            string[] keys = new string[] { "editor", "user" };
            foreach (string key in keys)
            {
                object raw;
                if (data == null || !data.TryGetValue(key, out raw)) continue;
                Dictionary<string, object> map = raw as Dictionary<string, object>;
                object username;
                if (map != null && map.TryGetValue("username", out username) && username is string)
                {
                    return (string)username;
                }
            }
            return "";
        }

        private static Member ToMember(Dictionary<string, object> map)
        {
            if (map == null) return null;
            Member member = new Member();
            member.Id = ReadString(map, "id");
            member.Username = ReadString(map, "username");
            member.Nickname = ReadString(map, "nickname");
            member.Role = ReadString(map, "role") == "admin" ? "admin" : "user";
            string status = ReadString(map, "status");
            member.Status = status == "suspended" || status == "restricted" ? status : "active";
            member.SanctionUntil = ReadString(map, "sanctionUntil");
            member.SanctionReason = ReadString(map, "sanctionReason");
            member.CreatedAt = ReadString(map, "createdAt");
            member.Email = ReadString(map, "email");
            object verified;
            member.Verified = map.TryGetValue("verified", out verified) && verified is bool && (bool)verified;
            object consent;
            if (map.TryGetValue("emailConsent", out consent) && consent is bool) member.EmailConsent = (bool)consent;
            return member.Id.Length > 0 ? member : null;
        }

        private static string ReadString(Dictionary<string, object> map, string key)
        {
            object value;
            if (map.TryGetValue(key, out value) && value is string) return (string)value;
            return "";
        }

        private Dictionary<string, object> Send(
            string path, string method, Dictionary<string, object> payload, int timeoutMs)
        {
            if (BaseUrl.Length == 0) throw new EditorException("network_error");

            HttpWebRequest request;
            try
            {
                request = (HttpWebRequest)WebRequest.Create(BaseUrl + "/functions/v1/app" + path);
            }
            catch
            {
                throw new EditorException("network_error");
            }

            request.Method = method;
            request.Accept = "application/json";
            request.Timeout = timeoutMs;
            request.ReadWriteTimeout = timeoutMs;
            request.UserAgent = "DimensionEditor/2.0";
            // The published gateway rejects non-GET requests without a site origin.
            try { request.Headers["Origin"] = new Uri(BaseUrl).GetLeftPart(UriPartial.Authority); }
            catch { }
            if (Token.Length > 0) request.Headers["Authorization"] = "Bearer " + Token;
            if (payload != null)
            {
                byte[] body = Encoding.UTF8.GetBytes(serializer.Serialize(payload));
                request.ContentType = "application/json";
                request.ContentLength = body.Length;
                using (Stream stream = request.GetRequestStream())
                {
                    stream.Write(body, 0, body.Length);
                }
            }

            HttpWebResponse response;
            try
            {
                response = (HttpWebResponse)request.GetResponse();
            }
            catch (WebException error)
            {
                response = error.Response as HttpWebResponse;
                if (response == null) throw new EditorException("network_error");
            }

            string text;
            int status;
            using (response)
            {
                status = (int)response.StatusCode;
                using (Stream stream = response.GetResponseStream())
                using (StreamReader reader = new StreamReader(stream, Encoding.UTF8))
                {
                    text = reader.ReadToEnd();
                }
            }

            Dictionary<string, object> data = Parse(text);
            if (status < 200 || status >= 300)
            {
                object code;
                // The application replies with "error"; the published gateway
                // replies with "code". Both must surface instead of a generic
                // invalid_response so the operator can tell them apart.
                if (data != null && data.TryGetValue("error", out code) && code is string)
                {
                    throw new EditorException((string)code);
                }
                if (data != null && data.TryGetValue("code", out code) && code is string)
                {
                    throw new EditorException((string)code);
                }
                throw new EditorException("http_" + status.ToString(CultureInfo.InvariantCulture));
            }
            return data;
        }

        private Dictionary<string, object> Parse(string text)
        {
            if (string.IsNullOrEmpty(text)) return null;
            try
            {
                return serializer.DeserializeObject(text) as Dictionary<string, object>;
            }
            catch
            {
                return null;
            }
        }
    }

    internal sealed class TabButton : Button
    {
        public bool Active;
        public bool Locked;

        public TabButton(string text)
        {
            Text = text;
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint
                | ControlStyles.OptimizedDoubleBuffer, true);
            FlatStyle = FlatStyle.Flat;
            FlatAppearance.BorderSize = 0;
            BackColor = Theme.Bg;
            ForeColor = Theme.Muted;
            Font = Theme.Bold(10f);
            Width = 148;
            Height = 44;
            Cursor = Cursors.Hand;
            TabStop = false;
            UseVisualStyleBackColor = false;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            e.Graphics.Clear(Active ? Theme.Panel : Theme.Bg);
            if (Active)
            {
                using (Pen pen = new Pen(Theme.Accent, 2))
                {
                    e.Graphics.DrawLine(pen, 0, Height - 2, Width, Height - 2);
                }
            }
            TextRenderer.DrawText(
                e.Graphics,
                Text,
                Font,
                ClientRectangle,
                Active ? Theme.Accent : (Locked ? ColorTranslator.FromHtml("#4A5366") : Theme.Muted),
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        }
    }

    internal sealed class MainForm : Form
    {
        private static readonly string[] FieldKeys = new string[]
        {
            "server_name", "tagline", "status_text", "discord_url",
            "java_host", "java_port", "bedrock_host", "bedrock_port", "status_note",
        };

        private static readonly string[] IconNames = new string[]
        {
            "Sparkles", "Users", "Zap", "Anvil", "Hammer", "Fish", "Compass", "PawPrint",
            "Swords", "Crown", "Medal", "Trophy", "Gem", "Flame", "Leaf", "Mountain",
            "Tent", "Backpack", "Shield", "Star",
        };

        private static readonly Dictionary<string, string> IconLabels = new Dictionary<string, string>
        {
            { "Sparkles", "차원 · 반짝임" }, { "Users", "직업 · 사람들" }, { "Zap", "스킬 · 번개" },
            { "Anvil", "강화 · 모루" }, { "Hammer", "조합 · 망치" }, { "Fish", "낚시" },
            { "Compass", "탈것 · 나침반" }, { "PawPrint", "펫 · 발자국" }, { "Swords", "파티 · 쌍검" },
            { "Crown", "보스 · 왕관" }, { "Medal", "칭호 · 메달" }, { "Trophy", "랭킹 · 트로피" },
            { "Gem", "보석" }, { "Flame", "불꽃" }, { "Leaf", "잎" }, { "Mountain", "산" },
            { "Tent", "야영" }, { "Backpack", "배낭" }, { "Shield", "방패" }, { "Star", "별" },
        };

        private readonly EditorApi api = new EditorApi("");
        private readonly List<WorldCard> cards = new List<WorldCard>();
        private readonly List<Member> members = new List<Member>();
        private readonly Dictionary<string, TextBox> fields = new Dictionary<string, TextBox>();

        private TextBox siteBox;
        private TextBox userBox;
        private TextBox passBox;
        private CheckBox rememberBox;
        private Label connectNote;
        private Label sessionLabel;
        private Label footerNote;
        private Label cardCount;
        private Label memberCount;
        private Label memberNote;
        private Label memberDetail;
        private Panel loginForm;
        private Panel sessionCard;
        private Panel[] tabPanels;
        private TabButton[] tabButtons;
        private TableLayoutPanel cardHost;
        private DataGridView memberGrid;
        private TextBox memberSearch;
        private TextBox sanctionReason;
        private ComboBox memberFilter;
        private ComboBox sanctionDays;
        private DataGridView verifyGrid;
        private Label verifyCount;
        private Label verifyNote;
        private Button verifyRefreshButton;
        private Button verifyApproveButton;
        private Member verifySelected;
        private Button loginButton;
        private Button saveButton;
        private Button reloadButton;
        private Button addCardButton;
        private Button memberRefresh;
        private Button roleButton;
        private Button suspendButton;
        private Button restrictButton;
        private Button clearButton;
        private TextBox mailUrlBox;
        private TextBox mailTokenBox;
        private TextBox mailSenderBox;
        private TextBox mailSubjectBox;
        private TextBox mailBodyBox;
        private TextBox mailTestBox;
        private Label mailSettingsNote;
        private Label mailNote;
        private Label mailRecipients;
        private Button mailSaveButton;
        private Button mailSendButton;
        private Button mailTestButton;
        private DataGridView mailHistoryGrid;
        private bool mailLoaded;
        private bool mailConfigured;
        private int mailRecipientCount;
        private bool loggedIn;
        private string adminNickname = "관리자";
        private string adminUsername = "";
        private Member selectedMember;

        private readonly bool restoreSession;
        private readonly List<EventEntry> events = new List<EventEntry>();
        private EventEntry eventDraft;
        private EventBlock editingEventBlock;
        private ListBox eventList;
        private ListBox eventBlockList;
        private TableLayoutPanel eventEditor;
        private TextBox eventTitleBox;
        private TextBox eventTextBox;
        private Label eventBlockLabel;
        private Label eventCount;
        private Label eventNote;
        private Label eventThumbnailNote;
        private Label eventImageNote;
        private PictureBox eventThumbnailPreview;
        private PictureBox eventImagePreview;
        private Button eventSaveButton;
        private Button eventEditButton;
        private Button eventDeleteButton;
        private Button eventReplacePhotoButton;
        private Button eventUpButton;
        private Button eventDownButton;
        private Button eventRemoveButton;
        private Button eventAddTextButton;
        private Button eventAddPhotoButton;
        private bool eventsLoaded;
        private bool eventsBusy;
        private bool eventBinding;
        private bool eventDirty;
        private int eventSessionVersion;

        public MainForm() : this(true)
        {
        }

        // Local reflection smoke tests use false; no saved session is read or restored.
        internal MainForm(bool restoreSavedSession)
        {
            restoreSession = restoreSavedSession;
            AutoScaleMode = AutoScaleMode.Dpi;
            AutoScaleDimensions = new SizeF(96f, 96f);
            Text = "DIMENSION 홈페이지 편집기 v2.3";
            BackColor = Theme.Bg;
            ForeColor = Theme.Text;
            Font = Theme.Body();
            ClientSize = new Size(1060, 880);
            MinimumSize = new Size(960, 740);
            StartPosition = FormStartPosition.CenterScreen;
            DoubleBuffered = true;

            BuildLayout();
        }

        [DllImport("user32.dll")]
        private static extern bool SetProcessDPIAware();

        private void BuildLayout()
        {
            TableLayoutPanel root = new TableLayoutPanel();
            root.Dock = DockStyle.Fill;
            root.ColumnCount = 1;
            root.RowCount = 4;
            root.BackColor = Theme.Bg;
            root.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 76f));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 44f));
            root.RowStyles.Add(new RowStyle(SizeType.Percent, 100f));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 66f));
            Controls.Add(root);

            root.Controls.Add(BuildHeader(), 0, 0);

            Panel tabBar = new Panel();
            tabBar.Dock = DockStyle.Fill;
            tabBar.BackColor = Theme.Bg;
            tabBar.Padding = new Padding(20, 0, 20, 0);
            FlowLayoutPanel tabs = new FlowLayoutPanel();
            tabs.Dock = DockStyle.Fill;
            tabs.BackColor = Theme.Bg;
            tabs.WrapContents = false;
            tabBar.Controls.Add(tabs);
            tabButtons = new TabButton[7];
            string[] titles = new string[] { "사이트 연결", "서버 정보", "홈 콘텐츠 카드", "회원 관리", "인증 요청", "메일 발송", "이벤트" };
            for (int index = 0; index < titles.Length; index += 1)
            {
                TabButton button = new TabButton(titles[index]);
                button.Width = 120;
                button.Margin = new Padding(0);
                int captured = index;
                button.Click += delegate { SwitchTab(captured); };
                tabButtons[index] = button;
                tabs.Controls.Add(button);
            }
            root.Controls.Add(tabBar, 0, 1);

            Panel content = new Panel();
            content.Dock = DockStyle.Fill;
            content.BackColor = Theme.Bg;
            root.Controls.Add(content, 0, 2);

            tabPanels = new Panel[7];
            tabPanels[0] = BuildConnectTab();
            tabPanels[1] = BuildServerTab();
            tabPanels[2] = BuildCardsTab();
            tabPanels[3] = BuildMembersTab();
            tabPanels[4] = BuildVerifyTab();
            tabPanels[5] = BuildMailTab();
            tabPanels[6] = BuildEventsTab();
            for (int index = 0; index < tabPanels.Length; index += 1)
            {
                tabPanels[index].Dock = DockStyle.Fill;
                tabPanels[index].Visible = index == 0;
                content.Controls.Add(tabPanels[index]);
            }

            root.Controls.Add(BuildFooter(), 0, 3);
            SwitchTab(0);
        }

        private Control BuildHeader()
        {
            Panel header = new Panel();
            header.Dock = DockStyle.Fill;
            header.BackColor = Theme.Panel;
            header.Padding = new Padding(24, 14, 24, 12);

            Label mark = new Label();
            mark.Text = "DIMENSION";
            mark.Font = Theme.Title();
            mark.ForeColor = Theme.Accent;
            mark.AutoSize = true;
            mark.Location = new Point(24, 14);
            header.Controls.Add(mark);

            Label sub = new Label();
            sub.Text = "홈페이지 편집기";
            sub.Font = new Font("Malgun Gothic", 10f, FontStyle.Regular);
            sub.ForeColor = Theme.Muted;
            sub.AutoSize = true;
            sub.Location = new Point(150, 24);
            header.Controls.Add(sub);

            sessionLabel = new Label();
            sessionLabel.Text = "로그인 전";
            sessionLabel.Font = Theme.Small();
            sessionLabel.ForeColor = Theme.Muted;
            sessionLabel.AutoSize = false;
            sessionLabel.Width = 260;
            sessionLabel.Height = 20;
            sessionLabel.Dock = DockStyle.Right;
            sessionLabel.TextAlign = ContentAlignment.MiddleRight;
            sessionLabel.Padding = new Padding(0, 0, 2, 0);
            header.Controls.Add(sessionLabel);

            return header;
        }

        private Panel BuildConnectTab()
        {
            Panel tab = new Panel();
            tab.AutoScroll = true;
            tab.BackColor = Theme.Bg;
            tab.Padding = new Padding(24, 18, 24, 16);

            loginForm = BuildLoginForm();
            tab.Controls.Add(loginForm);

            sessionCard = BuildSessionCard();
            sessionCard.Visible = false;
            tab.Controls.Add(sessionCard);

            return tab;
        }

        private Panel BuildLoginForm()
        {
            Panel panel = new Panel();
            panel.Dock = DockStyle.Top;
            panel.AutoSize = true;
            panel.AutoSizeMode = AutoSizeMode.GrowAndShrink;

            TableLayoutPanel grid = new TableLayoutPanel();
            grid.Dock = DockStyle.Top;
            grid.AutoSize = true;
            grid.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            grid.ColumnCount = 5;
            grid.RowCount = 6;
            grid.BackColor = Theme.Panel;
            grid.Padding = new Padding(18, 16, 18, 16);
            grid.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 92f));
            grid.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
            grid.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 76f));
            grid.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 220f));
            grid.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 106f));
            for (int index = 0; index < 6; index += 1)
            {
                grid.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            }
            panel.Controls.Add(grid);

            Label heading = new Label();
            heading.Text = "관리자 로그인";
            heading.Font = Theme.Bold(11f);
            heading.ForeColor = Theme.Text;
            heading.AutoSize = true;
            heading.Margin = new Padding(0, 0, 0, 10);
            grid.Controls.Add(heading, 0, 0);
            grid.SetColumnSpan(heading, 5);

            Label siteLabel = MakeLabel("사이트 주소");
            grid.Controls.Add(siteLabel, 0, 1);
            siteBox = MakeInput(false);
            grid.Controls.Add(siteBox, 1, 1);
            grid.SetColumnSpan(siteBox, 4);

            grid.Controls.Add(MakeLabel("아이디"), 0, 2);
            userBox = MakeInput(false);
            grid.Controls.Add(userBox, 1, 2);

            Label passLabel = MakeLabel("비밀번호");
            grid.Controls.Add(passLabel, 2, 2);
            passBox = MakeInput(true);
            grid.Controls.Add(passBox, 3, 2);

            loginButton = MakeButton("로그인", true);
            loginButton.Margin = new Padding(8, 0, 0, 0);
            loginButton.Click += delegate { Login(); };
            grid.Controls.Add(loginButton, 4, 2);

            connectNote = MakeNote();
            connectNote.Margin = new Padding(0, 10, 0, 0);
            grid.Controls.Add(connectNote, 0, 3);
            grid.SetColumnSpan(connectNote, 5);

            Label hint = new Label();
            hint.Text = "v2.3 · 관리자 계정으로 로그인합니다. 비밀번호는 저장하지 않으며, 발급된 편집 토큰만 이 PC에 보관됩니다.";
            hint.Font = Theme.Small();
            hint.ForeColor = Theme.Muted;
            hint.AutoSize = false;
            hint.Dock = DockStyle.Fill;
            hint.Height = 20;
            hint.TextAlign = ContentAlignment.MiddleLeft;
            hint.Margin = new Padding(0, 12, 0, 0);
            grid.Controls.Add(hint, 0, 4);
            grid.SetColumnSpan(hint, 5);

            rememberBox = new CheckBox();
            rememberBox.Text = "로그인 상태 유지 (다음 실행 때 자동 로그인)";
            rememberBox.Font = Theme.Small();
            rememberBox.ForeColor = Theme.Text;
            rememberBox.BackColor = Theme.Panel;
            rememberBox.AutoSize = true;
            rememberBox.Checked = true;
            rememberBox.Margin = new Padding(0, 8, 0, 0);
            grid.Controls.Add(rememberBox, 0, 5);
            grid.SetColumnSpan(rememberBox, 5);

            return panel;
        }

        private Panel BuildSessionCard()
        {
            Panel panel = new Panel();
            panel.Dock = DockStyle.Top;
            panel.AutoSize = true;
            panel.AutoSizeMode = AutoSizeMode.GrowAndShrink;

            TableLayoutPanel grid = new TableLayoutPanel();
            grid.Dock = DockStyle.Top;
            grid.AutoSize = true;
            grid.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            grid.ColumnCount = 2;
            grid.RowCount = 3;
            grid.BackColor = Theme.Panel;
            grid.Padding = new Padding(18, 16, 18, 16);
            grid.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
            grid.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 120f));
            for (int index = 0; index < 3; index += 1)
            {
                grid.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            }
            panel.Controls.Add(grid);

            Label heading = new Label();
            heading.Text = "로그인됨";
            heading.Font = Theme.Bold(11f);
            heading.ForeColor = Theme.Text;
            heading.AutoSize = true;
            heading.Margin = new Padding(0, 0, 0, 8);
            grid.Controls.Add(heading, 0, 0);
            grid.SetColumnSpan(heading, 2);

            Label body = new Label();
            body.Text = "서버 정보와 홈 카드, 회원 관리를 이 프로그램에서 바로 수정할 수 있습니다.";
            body.Font = Theme.Small();
            body.ForeColor = Theme.Muted;
            body.AutoSize = true;
            body.Margin = new Padding(0, 0, 0, 12);
            grid.Controls.Add(body, 0, 1);
            grid.SetColumnSpan(body, 2);

            Button logout = MakeButton("로그아웃", false);
            logout.Anchor = AnchorStyles.Right;
            logout.Click += delegate { Logout(); };
            grid.Controls.Add(logout, 1, 2);

            return panel;
        }

        private Panel BuildServerTab()
        {
            Panel tab = new Panel();
            tab.AutoScroll = true;
            tab.BackColor = Theme.Bg;
            tab.Padding = new Padding(24, 18, 24, 16);

            TableLayoutPanel body = new TableLayoutPanel();
            body.AutoSize = true;
            body.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            body.ColumnCount = 1;
            body.Dock = DockStyle.Top;
            body.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));

            TableLayoutPanel section = new TableLayoutPanel();
            section.AutoSize = true;
            section.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            section.Anchor = AnchorStyles.Left | AnchorStyles.Right;
            section.BackColor = Theme.Panel;
            section.Padding = new Padding(18, 16, 18, 18);
            section.ColumnCount = 4;
            section.RowCount = 5;
            section.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 106f));
            section.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50f));
            section.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 106f));
            section.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50f));
            for (int index = 0; index < 5; index += 1)
            {
                section.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            }

            AddFieldRow(section, 0, "server_name", "서버 이름", "tagline", "한 줄 소개");
            AddFieldRow(section, 1, "status_text", "상태 문구", "discord_url", "디스코드 링크");
            AddFieldRow(section, 2, "java_host", "Java 주소", "java_port", "Java 포트");
            AddFieldRow(section, 3, "bedrock_host", "Bedrock 주소", "bedrock_port", "Bedrock 포트");
            Label noteLabel = MakeLabel("상태 안내문");
            section.Controls.Add(noteLabel, 0, 4);
            TextBox noteBox = MakeInput(false);
            noteBox.Multiline = true;
            noteBox.Height = 64;
            noteBox.ScrollBars = ScrollBars.Vertical;
            noteBox.Margin = new Padding(0, 4, 0, 0);
            fields["status_note"] = noteBox;
            section.Controls.Add(noteBox, 1, 4);
            section.SetColumnSpan(noteBox, 3);

            body.Controls.Add(section, 0, 0);

            Label hint = new Label();
            hint.Text = "수정한 내용은 '저장'을 누르면 홈페이지에 바로 반영됩니다.\n"
                + "입력한 접속 주소는 승인된 회원에게만 표시되며, 공개 페이지에는 노출되지 않습니다.\n"
                + "실시간 운영 상태와 접속 인원은 인게임 플러그인이 자동으로 보냅니다.";
            hint.Font = Theme.Small();
            hint.ForeColor = Theme.Muted;
            hint.AutoSize = true;
            hint.Margin = new Padding(2, 12, 0, 0);
            body.Controls.Add(hint, 0, 1);

            tab.Controls.Add(body);
            return tab;
        }

        private Panel BuildCardsTab()
        {
            Panel tab = new Panel();
            tab.AutoScroll = true;
            tab.BackColor = Theme.Bg;
            tab.Padding = new Padding(24, 18, 24, 16);

            TableLayoutPanel body = new TableLayoutPanel();
            body.AutoSize = true;
            body.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            body.ColumnCount = 1;
            body.Dock = DockStyle.Top;
            body.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));

            TableLayoutPanel section = new TableLayoutPanel();
            section.AutoSize = true;
            section.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            section.Anchor = AnchorStyles.Left | AnchorStyles.Right;
            section.BackColor = Theme.Panel;
            section.Padding = new Padding(18, 16, 18, 18);
            section.ColumnCount = 2;
            section.RowCount = 3;
            section.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
            section.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
            for (int index = 0; index < 3; index += 1)
            {
                section.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            }

            Label intro = new Label();
            intro.Text = "홈페이지 '이 세계에서 벌어지는 일' 영역의 카드입니다. 최대 16개까지 넣을 수 있습니다.";
            intro.Font = Theme.Small();
            intro.ForeColor = Theme.Muted;
            intro.AutoSize = true;
            intro.Margin = new Padding(0, 0, 0, 10);
            section.Controls.Add(intro, 0, 0);
            section.SetColumnSpan(intro, 2);

            cardCount = new Label();
            cardCount.Text = "0 / 16";
            cardCount.Font = Theme.Small();
            cardCount.ForeColor = Theme.Muted;
            cardCount.AutoSize = true;
            cardCount.Anchor = AnchorStyles.Left;
            section.Controls.Add(cardCount, 0, 1);

            addCardButton = MakeButton("+ 카드 추가", false);
            addCardButton.Anchor = AnchorStyles.Right;
            addCardButton.Margin = new Padding(0, 0, 0, 10);
            addCardButton.Click += delegate
            {
                if (cards.Count >= 16)
                {
                    SetFooterNote("카드는 16개까지 추가할 수 있습니다.", Theme.Danger);
                    return;
                }
                cards.Add(new WorldCard());
                RebuildCards();
                SetFooterNote("카드를 추가했습니다. 제목과 설명을 입력해 주세요.", Theme.Muted);
            };
            section.Controls.Add(addCardButton, 1, 1);

            cardHost = new TableLayoutPanel();
            cardHost.AutoSize = true;
            cardHost.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            cardHost.ColumnCount = 1;
            cardHost.Dock = DockStyle.Top;
            cardHost.BackColor = Theme.Panel;
            cardHost.Padding = new Padding(18, 16, 18, 18);
            cardHost.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
            section.Controls.Add(cardHost, 0, 2);
            section.SetColumnSpan(cardHost, 2);

            body.Controls.Add(section, 0, 0);
            tab.Controls.Add(body);
            return tab;
        }

        private Panel BuildMembersTab()
        {
            Panel tab = new Panel();
            tab.BackColor = Theme.Bg;
            tab.Padding = new Padding(24, 18, 24, 16);

            TableLayoutPanel layout = new TableLayoutPanel();
            layout.Dock = DockStyle.Fill;
            layout.ColumnCount = 1;
            layout.RowCount = 3;
            layout.BackColor = Theme.Bg;
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100f));
            layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 208f));
            tab.Controls.Add(layout);

            TableLayoutPanel toolbar = new TableLayoutPanel();
            toolbar.AutoSize = true;
            toolbar.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            toolbar.Anchor = AnchorStyles.Left | AnchorStyles.Right;
            toolbar.ColumnCount = 5;
            toolbar.RowCount = 1;
            toolbar.BackColor = Theme.Bg;
            toolbar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 92f));
            toolbar.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
            toolbar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 170f));
            toolbar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 92f));
            toolbar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 110f));
            layout.Controls.Add(toolbar, 0, 0);

            Label searchLabel = MakeLabel("회원 검색");
            searchLabel.Margin = new Padding(0, 8, 0, 10);
            toolbar.Controls.Add(searchLabel, 0, 0);

            memberSearch = MakeInput(false);
            memberSearch.Margin = new Padding(0, 4, 12, 10);
            memberSearch.TextChanged += delegate { RefreshMemberView(); };
            toolbar.Controls.Add(memberSearch, 1, 0);

            memberFilter = new ComboBox();
            memberFilter.DropDownStyle = ComboBoxStyle.DropDownList;
            memberFilter.FlatStyle = FlatStyle.Flat;
            memberFilter.BackColor = Theme.Field;
            memberFilter.ForeColor = Theme.Text;
            memberFilter.Font = Theme.Body();
            memberFilter.Anchor = AnchorStyles.Left | AnchorStyles.Right;
            memberFilter.Margin = new Padding(0, 4, 12, 10);
            memberFilter.Items.AddRange(new object[] { "전체", "모험가", "관리자", "정지", "제한" });
            memberFilter.SelectedIndex = 0;
            memberFilter.SelectedIndexChanged += delegate { RefreshMemberView(); };
            toolbar.Controls.Add(memberFilter, 2, 0);

            memberCount = MakeNote();
            memberCount.Anchor = AnchorStyles.Left;
            memberCount.ForeColor = Theme.Muted;
            toolbar.Controls.Add(memberCount, 3, 0);

            memberRefresh = MakeButton("새로고침", false);
            memberRefresh.Anchor = AnchorStyles.Right;
            memberRefresh.Margin = new Padding(0, 2, 0, 10);
            memberRefresh.Click += delegate { LoadMembers(true); };
            toolbar.Controls.Add(memberRefresh, 4, 0);

            memberGrid = new DataGridView();
            memberGrid.Dock = DockStyle.Fill;
            memberGrid.BackgroundColor = Theme.Panel;
            memberGrid.BorderStyle = BorderStyle.None;
            memberGrid.GridColor = Theme.Border;
            memberGrid.EnableHeadersVisualStyles = false;
            memberGrid.ColumnHeadersDefaultCellStyle.BackColor = Theme.PanelAlt;
            memberGrid.ColumnHeadersDefaultCellStyle.ForeColor = Theme.Muted;
            memberGrid.ColumnHeadersDefaultCellStyle.SelectionBackColor = Theme.PanelAlt;
            memberGrid.ColumnHeadersDefaultCellStyle.Font = Theme.Small();
            memberGrid.DefaultCellStyle.BackColor = Theme.Panel;
            memberGrid.DefaultCellStyle.ForeColor = Theme.Text;
            memberGrid.DefaultCellStyle.SelectionBackColor = Theme.Select;
            memberGrid.DefaultCellStyle.SelectionForeColor = Theme.Text;
            memberGrid.DefaultCellStyle.Font = Theme.Body();
            memberGrid.RowTemplate.Height = 32;
            memberGrid.AllowUserToAddRows = false;
            memberGrid.AllowUserToDeleteRows = false;
            memberGrid.AllowUserToResizeRows = false;
            memberGrid.ReadOnly = true;
            memberGrid.RowHeadersVisible = false;
            memberGrid.MultiSelect = false;
            memberGrid.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
            memberGrid.AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill;
            memberGrid.Margin = new Padding(0, 0, 0, 12);
            AddGridColumn(memberGrid, "nickname", "닉네임", 20);
            AddGridColumn(memberGrid, "username", "아이디", 22);
            AddGridColumn(memberGrid, "email", "이메일", 26);
            AddGridColumn(memberGrid, "role", "권한", 11);
            AddGridColumn(memberGrid, "status", "상태", 15);
            AddGridColumn(memberGrid, "created", "가입일", 14);
            memberGrid.SelectionChanged += delegate { ShowSelectedMember(); };
            layout.Controls.Add(memberGrid, 0, 1);

            layout.Controls.Add(BuildMemberDetail(), 0, 2);
            return tab;
        }

        private Panel BuildVerifyTab()
        {
            Panel tab = new Panel();
            tab.BackColor = Theme.Bg;
            tab.Padding = new Padding(24, 18, 24, 16);

            TableLayoutPanel layout = new TableLayoutPanel();
            layout.Dock = DockStyle.Fill;
            layout.ColumnCount = 1;
            layout.RowCount = 3;
            layout.BackColor = Theme.Bg;
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100f));
            layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 84f));
            tab.Controls.Add(layout);

            TableLayoutPanel toolbar = new TableLayoutPanel();
            toolbar.AutoSize = true;
            toolbar.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            toolbar.Anchor = AnchorStyles.Left | AnchorStyles.Right;
            toolbar.ColumnCount = 3;
            toolbar.RowCount = 2;
            toolbar.BackColor = Theme.Bg;
            toolbar.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
            toolbar.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
            toolbar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 110f));
            layout.Controls.Add(toolbar, 0, 0);

            Label heading = new Label();
            heading.Text = "인증 요청";
            heading.Font = Theme.Bold(11.5f);
            heading.ForeColor = Theme.Text;
            heading.AutoSize = true;
            heading.Margin = new Padding(0, 0, 10, 8);
            toolbar.Controls.Add(heading, 0, 0);

            verifyCount = MakeNote();
            verifyCount.Text = "대기 0명";
            verifyCount.Anchor = AnchorStyles.Right;
            verifyCount.Margin = new Padding(0, 2, 12, 6);
            toolbar.Controls.Add(verifyCount, 1, 0);

            verifyRefreshButton = MakeButton("새로고침", false);
            verifyRefreshButton.Anchor = AnchorStyles.Right;
            verifyRefreshButton.Margin = new Padding(0, 0, 0, 8);
            verifyRefreshButton.Click += delegate { LoadVerify(); };
            toolbar.Controls.Add(verifyRefreshButton, 2, 0);

            Label hint = new Label();
            hint.Text = "가입 후 아직 승인되지 않은 회원입니다. 승인하면 바로 채팅에 참여할 수 있습니다.";
            hint.Font = Theme.Small();
            hint.ForeColor = Theme.Muted;
            hint.AutoSize = false;
            hint.Dock = DockStyle.Fill;
            hint.Height = 20;
            hint.TextAlign = ContentAlignment.MiddleLeft;
            hint.Margin = new Padding(0, 0, 0, 8);
            toolbar.Controls.Add(hint, 0, 1);
            toolbar.SetColumnSpan(hint, 3);

            verifyGrid = new DataGridView();
            verifyGrid.Dock = DockStyle.Fill;
            verifyGrid.BackgroundColor = Theme.Panel;
            verifyGrid.BorderStyle = BorderStyle.None;
            verifyGrid.GridColor = Theme.Border;
            verifyGrid.EnableHeadersVisualStyles = false;
            verifyGrid.ColumnHeadersDefaultCellStyle.BackColor = Theme.PanelAlt;
            verifyGrid.ColumnHeadersDefaultCellStyle.ForeColor = Theme.Muted;
            verifyGrid.ColumnHeadersDefaultCellStyle.SelectionBackColor = Theme.PanelAlt;
            verifyGrid.ColumnHeadersDefaultCellStyle.Font = Theme.Small();
            verifyGrid.DefaultCellStyle.BackColor = Theme.Panel;
            verifyGrid.DefaultCellStyle.ForeColor = Theme.Text;
            verifyGrid.DefaultCellStyle.SelectionBackColor = Theme.Select;
            verifyGrid.DefaultCellStyle.SelectionForeColor = Theme.Text;
            verifyGrid.DefaultCellStyle.Font = Theme.Body();
            verifyGrid.RowTemplate.Height = 32;
            verifyGrid.AllowUserToAddRows = false;
            verifyGrid.AllowUserToDeleteRows = false;
            verifyGrid.AllowUserToResizeRows = false;
            verifyGrid.ReadOnly = true;
            verifyGrid.RowHeadersVisible = false;
            verifyGrid.MultiSelect = false;
            verifyGrid.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
            verifyGrid.AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill;
            verifyGrid.Margin = new Padding(0, 0, 0, 12);
            AddGridColumn(verifyGrid, "nickname", "닉네임", 24);
            AddGridColumn(verifyGrid, "username", "아이디", 24);
            AddGridColumn(verifyGrid, "email", "이메일", 32);
            AddGridColumn(verifyGrid, "created", "가입일", 20);
            verifyGrid.SelectionChanged += delegate { ShowSelectedVerify(); };
            layout.Controls.Add(verifyGrid, 0, 1);

            TableLayoutPanel actionRow = new TableLayoutPanel();
            actionRow.Dock = DockStyle.Fill;
            actionRow.ColumnCount = 2;
            actionRow.RowCount = 1;
            actionRow.BackColor = Theme.Panel;
            actionRow.Padding = new Padding(18, 10, 18, 10);
            actionRow.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
            actionRow.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 150f));
            layout.Controls.Add(actionRow, 0, 2);

            verifyNote = MakeNote();
            verifyNote.Text = "대기 중인 인증 요청이 없습니다.";
            verifyNote.AutoSize = false;
            verifyNote.Dock = DockStyle.Fill;
            verifyNote.TextAlign = ContentAlignment.MiddleLeft;
            actionRow.Controls.Add(verifyNote, 0, 0);

            verifyApproveButton = MakeButton("인증 승인", true);
            verifyApproveButton.Dock = DockStyle.Fill;
            verifyApproveButton.Enabled = false;
            verifyApproveButton.Margin = new Padding(0, 2, 0, 0);
            verifyApproveButton.Click += delegate { ApproveVerify(); };
            actionRow.Controls.Add(verifyApproveButton, 1, 0);

            return tab;
        }

        private static void AddGridColumn(DataGridView grid, string name, string header, int weight)
        {
            DataGridViewTextBoxColumn column = new DataGridViewTextBoxColumn();
            column.Name = name;
            column.HeaderText = header;
            column.FillWeight = weight;
            column.SortMode = DataGridViewColumnSortMode.NotSortable;
            grid.Columns.Add(column);
        }

        private Control BuildMemberDetail()
        {
            TableLayoutPanel detail = new TableLayoutPanel();
            detail.Dock = DockStyle.Fill;
            detail.ColumnCount = 1;
            detail.RowCount = 5;
            detail.BackColor = Theme.Panel;
            detail.Padding = new Padding(18, 14, 18, 14);
            detail.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
            detail.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            detail.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            detail.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            detail.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            detail.RowStyles.Add(new RowStyle(SizeType.Percent, 100f));

            memberDetail = new Label();
            memberDetail.Text = "목록에서 회원을 선택하세요.";
            memberDetail.Font = Theme.Bold(10.5f);
            memberDetail.ForeColor = Theme.Text;
            memberDetail.AutoSize = true;
            memberDetail.Margin = new Padding(0, 0, 0, 10);
            detail.Controls.Add(memberDetail, 0, 0);

            TableLayoutPanel labels = new TableLayoutPanel();
            labels.AutoSize = true;
            labels.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            labels.ColumnCount = 3;
            labels.RowCount = 1;
            labels.Anchor = AnchorStyles.Left | AnchorStyles.Right;
            labels.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 132f));
            labels.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 120f));
            labels.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
            labels.Margin = new Padding(0, 0, 0, 4);
            string[] captions = new string[] { "권한 변경", "제재 기간", "제재 사유 (선택)" };
            for (int index = 0; index < captions.Length; index++)
            {
                Label caption = new Label();
                caption.Text = captions[index];
                caption.Font = Theme.Small();
                caption.ForeColor = Theme.Muted;
                caption.AutoSize = true;
                caption.Margin = new Padding(0);
                labels.Controls.Add(caption, index, 0);
            }
            detail.Controls.Add(labels, 0, 1);

            TableLayoutPanel actions = new TableLayoutPanel();
            actions.AutoSize = true;
            actions.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            actions.ColumnCount = 6;
            actions.RowCount = 1;
            actions.Anchor = AnchorStyles.Left | AnchorStyles.Right;
            actions.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 132f));
            actions.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 120f));
            actions.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
            actions.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 84f));
            actions.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 84f));
            actions.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 84f));
            detail.Controls.Add(actions, 0, 2);

            roleButton = MakeButton("관리자 지정", false);
            roleButton.Anchor = AnchorStyles.Left;
            roleButton.Margin = new Padding(0, 0, 10, 0);
            roleButton.Click += delegate { ChangeRole(); };
            actions.Controls.Add(roleButton, 0, 0);

            sanctionDays = new ComboBox();
            sanctionDays.DropDownStyle = ComboBoxStyle.DropDownList;
            sanctionDays.FlatStyle = FlatStyle.Flat;
            sanctionDays.BackColor = Theme.Field;
            sanctionDays.ForeColor = Theme.Text;
            sanctionDays.Font = Theme.Body();
            sanctionDays.Anchor = AnchorStyles.Left | AnchorStyles.Right;
            sanctionDays.Margin = new Padding(0, 0, 10, 0);
            sanctionDays.Items.AddRange(new object[] { "1일", "7일", "30일", "무기한" });
            sanctionDays.SelectedIndex = 1;
            actions.Controls.Add(sanctionDays, 1, 0);

            sanctionReason = MakeInput(false);
            sanctionReason.MaxLength = 200;
            sanctionReason.Margin = new Padding(0, 0, 10, 0);
            actions.Controls.Add(sanctionReason, 2, 0);

            suspendButton = MakeButton("정지", false);
            suspendButton.Anchor = AnchorStyles.Right;
            suspendButton.Margin = new Padding(0, 0, 6, 0);
            suspendButton.ForeColor = Theme.Danger;
            suspendButton.FlatAppearance.BorderColor = Theme.Danger;
            suspendButton.Click += delegate { Sanction("suspended"); };
            actions.Controls.Add(suspendButton, 3, 0);

            restrictButton = MakeButton("제한", false);
            restrictButton.Anchor = AnchorStyles.Right;
            restrictButton.Margin = new Padding(0, 0, 6, 0);
            restrictButton.Click += delegate { Sanction("restricted"); };
            actions.Controls.Add(restrictButton, 4, 0);

            clearButton = MakeButton("해제", false);
            clearButton.Anchor = AnchorStyles.Right;
            clearButton.Margin = new Padding(0);
            clearButton.Click += delegate { Sanction("active"); };
            actions.Controls.Add(clearButton, 5, 0);

            memberNote = MakeNote();
            memberNote.Dock = DockStyle.Fill;
            memberNote.TextAlign = ContentAlignment.MiddleLeft;
            memberNote.Margin = new Padding(0, 10, 0, 0);
            detail.Controls.Add(memberNote, 0, 3);

            Label hint = new Label();
            hint.Text = "정지는 로그인을, 제한은 자유·사진게시판 작성과 채팅을 막습니다. 관리자 계정은 먼저 권한을 해제해야 합니다.";
            hint.Font = Theme.Small();
            hint.ForeColor = Theme.Muted;
            hint.AutoSize = false;
            hint.Dock = DockStyle.Fill;
            hint.TextAlign = ContentAlignment.TopLeft;
            detail.Controls.Add(hint, 0, 4);

            return detail;
        }

        private Panel BuildMailTab()
        {
            Panel tab = new Panel();
            tab.BackColor = Theme.Bg;
            tab.Padding = new Padding(24, 18, 24, 16);

            TableLayoutPanel layout = new TableLayoutPanel();
            layout.Dock = DockStyle.Fill;
            layout.ColumnCount = 1;
            layout.RowCount = 3;
            layout.BackColor = Theme.Bg;
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100f));
            layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 176f));
            tab.Controls.Add(layout);

            TableLayoutPanel settings = new TableLayoutPanel();
            settings.Height = 96;
            settings.Anchor = AnchorStyles.Left | AnchorStyles.Right | AnchorStyles.Top;
            settings.ColumnCount = 4;
            settings.RowCount = 3;
            settings.BackColor = Theme.Panel;
            settings.Padding = new Padding(16, 10, 16, 10);
            settings.Margin = new Padding(0, 0, 0, 12);
            settings.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 42f));
            settings.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 30f));
            settings.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 28f));
            settings.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 104f));
            settings.RowStyles.Add(new RowStyle(SizeType.Absolute, 22f));
            settings.RowStyles.Add(new RowStyle(SizeType.Absolute, 32f));
            settings.RowStyles.Add(new RowStyle(SizeType.Percent, 100f));
            layout.Controls.Add(settings, 0, 0);

            Label urlLabel = MakeLabel("Gmail 릴레이 주소");
            urlLabel.Margin = new Padding(0, 0, 10, 2);
            settings.Controls.Add(urlLabel, 0, 0);

            Label tokenLabel = MakeLabel("릴레이 토큰");
            tokenLabel.Margin = new Padding(0, 0, 10, 2);
            settings.Controls.Add(tokenLabel, 1, 0);

            Label senderLabel = MakeLabel("발신 주소 (선택)");
            senderLabel.Margin = new Padding(0, 0, 10, 2);
            settings.Controls.Add(senderLabel, 2, 0);

            mailUrlBox = MakeInput(false);
            mailUrlBox.Margin = new Padding(0, 2, 10, 4);
            settings.Controls.Add(mailUrlBox, 0, 1);

            mailTokenBox = MakeInput(true);
            mailTokenBox.Margin = new Padding(0, 2, 10, 4);
            settings.Controls.Add(mailTokenBox, 1, 1);

            mailSenderBox = MakeInput(false);
            mailSenderBox.Margin = new Padding(0, 2, 10, 4);
            settings.Controls.Add(mailSenderBox, 2, 1);

            mailSaveButton = MakeButton("설정 저장", false);
            mailSaveButton.Dock = DockStyle.Fill;
            mailSaveButton.Margin = new Padding(0, 2, 0, 4);
            mailSaveButton.Click += delegate { SaveMailSettings(); };
            settings.Controls.Add(mailSaveButton, 3, 1);

            mailSettingsNote = MakeNote();
            mailSettingsNote.Dock = DockStyle.Fill;
            mailSettingsNote.Margin = new Padding(0, 2, 0, 0);
            settings.Controls.Add(mailSettingsNote, 0, 2);
            settings.SetColumnSpan(mailSettingsNote, 4);

            TableLayoutPanel compose = new TableLayoutPanel();
            compose.Dock = DockStyle.Fill;
            compose.ColumnCount = 3;
            compose.RowCount = 7;
            compose.BackColor = Theme.Panel;
            compose.Padding = new Padding(16, 10, 16, 10);
            compose.Margin = new Padding(0);
            compose.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
            compose.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 112f));
            compose.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 112f));
            compose.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            compose.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            compose.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            compose.RowStyles.Add(new RowStyle(SizeType.Percent, 100f));
            compose.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            compose.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            compose.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.Controls.Add(compose, 0, 1);

            Label subjectLabel = MakeLabel("제목");
            subjectLabel.Margin = new Padding(0, 0, 0, 2);
            compose.Controls.Add(subjectLabel, 0, 0);
            compose.SetColumnSpan(subjectLabel, 3);

            mailSubjectBox = MakeInput(false);
            mailSubjectBox.MaxLength = 120;
            mailSubjectBox.Margin = new Padding(0, 0, 0, 6);
            compose.Controls.Add(mailSubjectBox, 0, 1);
            compose.SetColumnSpan(mailSubjectBox, 3);

            Label bodyLabel = MakeLabel("내용");
            bodyLabel.Margin = new Padding(0, 0, 0, 2);
            compose.Controls.Add(bodyLabel, 0, 2);
            compose.SetColumnSpan(bodyLabel, 3);

            mailBodyBox = new TextBox();
            mailBodyBox.Multiline = true;
            mailBodyBox.ScrollBars = ScrollBars.Vertical;
            mailBodyBox.AcceptsReturn = true;
            mailBodyBox.Dock = DockStyle.Fill;
            mailBodyBox.BorderStyle = BorderStyle.FixedSingle;
            mailBodyBox.BackColor = Theme.Field;
            mailBodyBox.ForeColor = Theme.Text;
            mailBodyBox.Font = Theme.Body();
            mailBodyBox.MaxLength = 8000;
            mailBodyBox.Margin = new Padding(0, 0, 0, 6);
            compose.Controls.Add(mailBodyBox, 0, 3);
            compose.SetColumnSpan(mailBodyBox, 3);

            Label testLabel = MakeLabel("테스트 주소 (테스트 발송에만 사용)");
            testLabel.Margin = new Padding(0, 0, 0, 2);
            compose.Controls.Add(testLabel, 0, 4);
            compose.SetColumnSpan(testLabel, 3);

            mailTestBox = MakeInput(false);
            mailTestBox.Margin = new Padding(0, 0, 8, 0);
            compose.Controls.Add(mailTestBox, 0, 5);

            mailTestButton = MakeButton("테스트 발송", false);
            mailTestButton.Dock = DockStyle.Fill;
            mailTestButton.Margin = new Padding(0, 0, 6, 0);
            mailTestButton.Click += delegate { SendMail(true); };
            compose.Controls.Add(mailTestButton, 1, 5);

            mailSendButton = MakeButton("전체 발송", true);
            mailSendButton.Dock = DockStyle.Fill;
            mailSendButton.Margin = new Padding(0);
            mailSendButton.Click += delegate { SendMail(false); };
            compose.Controls.Add(mailSendButton, 2, 5);

            mailRecipients = MakeNote();
            mailRecipients.Text = "받는 사람 0명";
            mailRecipients.Margin = new Padding(0, 8, 0, 0);
            compose.Controls.Add(mailRecipients, 0, 6);

            mailNote = MakeNote();
            mailNote.Dock = DockStyle.Fill;
            mailNote.TextAlign = ContentAlignment.MiddleRight;
            mailNote.Margin = new Padding(0, 8, 0, 0);
            compose.Controls.Add(mailNote, 1, 6);
            compose.SetColumnSpan(mailNote, 2);

            TableLayoutPanel history = new TableLayoutPanel();
            history.Dock = DockStyle.Fill;
            history.ColumnCount = 2;
            history.RowCount = 2;
            history.BackColor = Theme.Panel;
            history.Padding = new Padding(16, 10, 16, 10);
            history.Margin = new Padding(0);
            history.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
            history.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 110f));
            history.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            history.RowStyles.Add(new RowStyle(SizeType.Percent, 100f));
            layout.Controls.Add(history, 0, 2);

            Label historyLabel = MakeLabel("발송 기록 (최근 20건)");
            historyLabel.Font = Theme.Bold(9.5f);
            historyLabel.ForeColor = Theme.Text;
            historyLabel.Margin = new Padding(0, 0, 0, 6);
            history.Controls.Add(historyLabel, 0, 0);

            Button historyRefresh = MakeButton("새로고침", false);
            historyRefresh.Anchor = AnchorStyles.Right;
            historyRefresh.Height = 28;
            historyRefresh.Margin = new Padding(0, 0, 0, 6);
            historyRefresh.Click += delegate { LoadMail(true); };
            history.Controls.Add(historyRefresh, 1, 0);

            mailHistoryGrid = new DataGridView();
            mailHistoryGrid.Dock = DockStyle.Fill;
            mailHistoryGrid.BackgroundColor = Theme.Panel;
            mailHistoryGrid.BorderStyle = BorderStyle.None;
            mailHistoryGrid.GridColor = Theme.Border;
            mailHistoryGrid.EnableHeadersVisualStyles = false;
            mailHistoryGrid.ColumnHeadersDefaultCellStyle.BackColor = Theme.PanelAlt;
            mailHistoryGrid.ColumnHeadersDefaultCellStyle.ForeColor = Theme.Muted;
            mailHistoryGrid.ColumnHeadersDefaultCellStyle.SelectionBackColor = Theme.PanelAlt;
            mailHistoryGrid.ColumnHeadersDefaultCellStyle.Font = Theme.Small();
            mailHistoryGrid.DefaultCellStyle.BackColor = Theme.Panel;
            mailHistoryGrid.DefaultCellStyle.ForeColor = Theme.Text;
            mailHistoryGrid.DefaultCellStyle.SelectionBackColor = Theme.Select;
            mailHistoryGrid.DefaultCellStyle.SelectionForeColor = Theme.Text;
            mailHistoryGrid.DefaultCellStyle.Font = Theme.Small();
            mailHistoryGrid.RowTemplate.Height = 28;
            mailHistoryGrid.AllowUserToAddRows = false;
            mailHistoryGrid.AllowUserToDeleteRows = false;
            mailHistoryGrid.AllowUserToResizeRows = false;
            mailHistoryGrid.ReadOnly = true;
            mailHistoryGrid.RowHeadersVisible = false;
            mailHistoryGrid.MultiSelect = false;
            mailHistoryGrid.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
            mailHistoryGrid.AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill;
            mailHistoryGrid.Margin = new Padding(0);
            AddGridColumn(mailHistoryGrid, "created", "보낸 날짜", 18);
            AddGridColumn(mailHistoryGrid, "subject", "제목", 46);
            AddGridColumn(mailHistoryGrid, "recipients", "대상", 12);
            AddGridColumn(mailHistoryGrid, "sent", "성공", 12);
            AddGridColumn(mailHistoryGrid, "failed", "실패", 12);
            history.Controls.Add(mailHistoryGrid, 0, 1);
            history.SetColumnSpan(mailHistoryGrid, 2);

            return tab;
        }

        private Panel BuildEventsTab()
        {
            Panel tab = new Panel();
            tab.BackColor = Theme.Bg;
            tab.Padding = new Padding(24, 18, 24, 16);
            tab.AutoScroll = true;
            TableLayoutPanel layout = new TableLayoutPanel();
            layout.Dock = DockStyle.Top;
            layout.Height = 590;
            layout.ColumnCount = 2;
            layout.RowCount = 1;
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 226f));
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
            layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100f));
            tab.Controls.Add(layout);
            tab.SizeChanged += delegate { layout.Height = Math.Max(590, tab.ClientSize.Height - tab.Padding.Vertical); };

            TableLayoutPanel catalog = new TableLayoutPanel();
            catalog.Dock = DockStyle.Fill;
            catalog.ColumnCount = 1;
            catalog.RowCount = 3;
            catalog.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
            catalog.RowStyles.Add(new RowStyle(SizeType.Absolute, 28f));
            catalog.RowStyles.Add(new RowStyle(SizeType.Percent, 100f));
            catalog.RowStyles.Add(new RowStyle(SizeType.Absolute, 84f));
            catalog.Margin = new Padding(0, 0, 12, 0);
            layout.Controls.Add(catalog, 0, 0);
            catalog.Controls.Add(MakeLabel("이벤트 목록 · 선택 후 편집"), 0, 0);
            eventList = MakeEventList();
            eventList.SelectedIndexChanged += delegate { UpdateEventButtons(); };
            eventList.DoubleClick += delegate { EditSelectedEvent(); };
            catalog.Controls.Add(eventList, 0, 1);
            FlowLayoutPanel actions = new FlowLayoutPanel();
            actions.Dock = DockStyle.Fill;
            actions.Margin = new Padding(0);
            Button create = MakeButton("새 이벤트", false);
            create.Width = 98;
            create.Click += delegate { NewEvent(); };
            eventEditButton = MakeButton("편집", false);
            eventEditButton.Width = 98;
            eventEditButton.Click += delegate { EditSelectedEvent(); };
            eventDeleteButton = MakeButton("삭제", false);
            eventDeleteButton.Width = 98;
            eventDeleteButton.Click += delegate { DeleteSelectedEvent(); };
            Button refresh = MakeButton("새로고침", false);
            refresh.Width = 98;
            refresh.Click += delegate { LoadEvents(); };
            actions.Controls.Add(create);
            actions.Controls.Add(eventEditButton);
            actions.Controls.Add(eventDeleteButton);
            actions.Controls.Add(refresh);
            catalog.Controls.Add(actions, 0, 2);

            eventEditor = new TableLayoutPanel();
            eventEditor.Dock = DockStyle.Fill;
            eventEditor.BackColor = Theme.Panel;
            eventEditor.Padding = new Padding(12);
            eventEditor.Margin = new Padding(0);
            eventEditor.ColumnCount = 1;
            eventEditor.RowCount = 8;
            eventEditor.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
            eventEditor.RowStyles.Add(new RowStyle(SizeType.Absolute, 26f));
            eventEditor.RowStyles.Add(new RowStyle(SizeType.Absolute, 34f));
            eventEditor.RowStyles.Add(new RowStyle(SizeType.Absolute, 114f));
            eventEditor.RowStyles.Add(new RowStyle(SizeType.Absolute, 26f));
            eventEditor.RowStyles.Add(new RowStyle(SizeType.Absolute, 40f));
            eventEditor.RowStyles.Add(new RowStyle(SizeType.Percent, 100f));
            eventEditor.RowStyles.Add(new RowStyle(SizeType.Absolute, 42f));
            eventEditor.RowStyles.Add(new RowStyle(SizeType.Absolute, 48f));
            layout.Controls.Add(eventEditor, 1, 0);
            eventEditor.Controls.Add(MakeLabel("이벤트 제목 (필수 · 최대 120자)"), 0, 0);
            eventTitleBox = MakeInput(false);
            eventTitleBox.MaxLength = 120;
            eventTitleBox.TextChanged += delegate
            {
                if (eventBinding || eventDraft == null) return;
                eventDraft.Title = eventTitleBox.Text;
                eventDirty = true;
                UpdateEventButtons();
            };
            eventEditor.Controls.Add(eventTitleBox, 0, 1);

            TableLayoutPanel thumbnail = new TableLayoutPanel();
            thumbnail.Dock = DockStyle.Fill;
            thumbnail.ColumnCount = 3;
            thumbnail.RowCount = 2;
            thumbnail.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 126f));
            thumbnail.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
            thumbnail.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 116f));
            thumbnail.RowStyles.Add(new RowStyle(SizeType.Absolute, 36f));
            thumbnail.RowStyles.Add(new RowStyle(SizeType.Percent, 100f));
            eventThumbnailPreview = MakeEventPreview();
            thumbnail.Controls.Add(eventThumbnailPreview, 0, 0);
            thumbnail.SetRowSpan(eventThumbnailPreview, 2);
            thumbnail.Controls.Add(MakeLabel("썸네일 (본문 사진과 별도 · 필수)"), 1, 0);
            eventThumbnailNote = MakeNote();
            eventThumbnailNote.Dock = DockStyle.Fill;
            eventThumbnailNote.AutoSize = false;
            eventThumbnailNote.Text = "PNG/JPEG · 최대 6 MiB\nWebP 선택/미리보기는 지원하지 않습니다.";
            thumbnail.Controls.Add(eventThumbnailNote, 1, 1);
            Button chooseThumbnail = MakeButton("썸네일 선택", false);
            chooseThumbnail.Width = 112;
            chooseThumbnail.Click += delegate { ChooseEventPhoto(true); };
            thumbnail.Controls.Add(chooseThumbnail, 2, 0);
            eventEditor.Controls.Add(thumbnail, 0, 2);

            eventCount = MakeLabel("본문 · 일반 텍스트/사진 (HTML 없음)");
            eventEditor.Controls.Add(eventCount, 0, 3);
            FlowLayoutPanel blockActions = new FlowLayoutPanel();
            blockActions.Dock = DockStyle.Fill;
            blockActions.WrapContents = false;
            blockActions.Margin = new Padding(0);
            eventAddTextButton = MakeButton("텍스트 추가", false);
            eventAddTextButton.Width = 104;
            eventAddTextButton.Click += delegate { AddEventBlock(false); };
            eventAddPhotoButton = MakeButton("사진 추가", false);
            eventAddPhotoButton.Width = 98;
            eventAddPhotoButton.Click += delegate { AddEventBlock(true); };
            eventUpButton = MakeButton("위로", false);
            eventUpButton.Width = 68;
            eventUpButton.Click += delegate { MoveEventBlock(-1); };
            eventDownButton = MakeButton("아래로", false);
            eventDownButton.Width = 68;
            eventDownButton.Click += delegate { MoveEventBlock(1); };
            eventRemoveButton = MakeButton("블록 삭제", false);
            eventRemoveButton.Width = 96;
            eventRemoveButton.Click += delegate { RemoveEventBlock(); };
            blockActions.Controls.Add(eventAddTextButton);
            blockActions.Controls.Add(eventAddPhotoButton);
            blockActions.Controls.Add(eventUpButton);
            blockActions.Controls.Add(eventDownButton);
            blockActions.Controls.Add(eventRemoveButton);
            eventEditor.Controls.Add(blockActions, 0, 4);

            TableLayoutPanel body = new TableLayoutPanel();
            body.Dock = DockStyle.Fill;
            body.ColumnCount = 2;
            body.RowCount = 1;
            body.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 176f));
            body.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
            body.RowStyles.Add(new RowStyle(SizeType.Percent, 100f));
            body.Margin = new Padding(0);
            eventBlockList = MakeEventList();
            eventBlockList.SelectedIndexChanged += delegate { if (!eventBinding) SelectEventBlock(); };
            body.Controls.Add(eventBlockList, 0, 0);
            TableLayoutPanel blockEditor = new TableLayoutPanel();
            blockEditor.Dock = DockStyle.Fill;
            blockEditor.ColumnCount = 1;
            blockEditor.RowCount = 3;
            blockEditor.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
            blockEditor.RowStyles.Add(new RowStyle(SizeType.Absolute, 26f));
            blockEditor.RowStyles.Add(new RowStyle(SizeType.Absolute, 104f));
            blockEditor.RowStyles.Add(new RowStyle(SizeType.Percent, 100f));
            body.Controls.Add(blockEditor, 1, 0);
            eventBlockLabel = MakeLabel("본문 텍스트");
            blockEditor.Controls.Add(eventBlockLabel, 0, 0);
            Panel imagePanel = new Panel();
            imagePanel.Dock = DockStyle.Fill;
            eventImagePreview = MakeEventPreview();
            imagePanel.Controls.Add(eventImagePreview);
            eventImageNote = MakeNote();
            eventImageNote.AutoSize = false;
            eventImageNote.Dock = DockStyle.Bottom;
            eventImageNote.Height = 22;
            imagePanel.Controls.Add(eventImageNote);
            eventReplacePhotoButton = MakeButton("사진 교체", false);
            eventReplacePhotoButton.Dock = DockStyle.Right;
            eventReplacePhotoButton.Width = 94;
            eventReplacePhotoButton.Click += delegate { ChooseEventPhoto(false); };
            imagePanel.Controls.Add(eventReplacePhotoButton);
            blockEditor.Controls.Add(imagePanel, 0, 1);
            eventTextBox = MakeInput(false);
            eventTextBox.Multiline = true;
            eventTextBox.AcceptsReturn = true;
            eventTextBox.ScrollBars = ScrollBars.Vertical;
            eventTextBox.MaxLength = 8000;
            eventTextBox.TextChanged += delegate
            {
                if (eventBinding || editingEventBlock == null) return;
                if (editingEventBlock.Type == "image") editingEventBlock.Caption = eventTextBox.Text;
                else editingEventBlock.Text = eventTextBox.Text;
                eventDirty = true;
                // Updating the item must not reload the text box or disturb its caret.
                int selected = eventBlockList.SelectedIndex;
                if (selected >= 0)
                {
                    eventBinding = true;
                    eventBlockList.Items[selected] = editingEventBlock;
                    eventBinding = false;
                }
                UpdateEventButtons();
            };
            blockEditor.Controls.Add(eventTextBox, 0, 2);
            eventEditor.Controls.Add(body, 0, 5);
            eventSaveButton = MakeButton("이벤트 저장", true);
            eventSaveButton.Width = 142;
            eventSaveButton.Anchor = AnchorStyles.Right;
            eventSaveButton.Click += delegate { SaveEventDraft(); };
            eventEditor.Controls.Add(eventSaveButton, 0, 6);
            eventNote = MakeNote();
            eventNote.AutoSize = false;
            eventNote.Dock = DockStyle.Fill;
            eventNote.Text = "새 이벤트를 만들거나 목록에서 선택 후 편집해 주세요.";
            eventEditor.Controls.Add(eventNote, 0, 7);
            return tab;
        }

        private static ListBox MakeEventList()
        {
            ListBox list = new ListBox();
            list.Dock = DockStyle.Fill;
            list.IntegralHeight = false;
            list.BackColor = Theme.Field;
            list.ForeColor = Theme.Text;
            list.BorderStyle = BorderStyle.FixedSingle;
            list.HorizontalScrollbar = true;
            return list;
        }

        private static PictureBox MakeEventPreview()
        {
            PictureBox picture = new PictureBox();
            picture.Dock = DockStyle.Fill;
            picture.BackColor = Theme.Field;
            picture.SizeMode = PictureBoxSizeMode.Zoom;
            return picture;
        }

        private void SetEventNote(string text, Color color)
        {
            eventNote.Text = text;
            eventNote.ForeColor = color;
        }

        private void UpdateEventButtons()
        {
            bool ready = loggedIn && !eventsBusy;
            bool draft = ready && eventDraft != null;
            eventEditor.Enabled = draft;
            eventEditButton.Enabled = ready && eventList.SelectedItem != null;
            eventDeleteButton.Enabled = eventEditButton.Enabled;
            eventSaveButton.Enabled = draft;
            int selected = eventBlockList.SelectedIndex;
            int count = eventDraft == null ? 0 : eventDraft.Blocks.Count;
            int photos = 0;
            int chars = 0;
            if (eventDraft != null)
            {
                foreach (EventBlock block in eventDraft.Blocks)
                {
                    if (block.Type == "image") { photos += 1; chars += block.Caption.Length; }
                    else chars += block.Text.Length;
                }
            }
            eventAddTextButton.Enabled = draft && count < 24;
            eventAddPhotoButton.Enabled = draft && count < 24 && photos < 8;
            eventUpButton.Enabled = draft && selected > 0;
            eventDownButton.Enabled = draft && selected >= 0 && selected < count - 1;
            eventRemoveButton.Enabled = draft && selected >= 0;
            eventTextBox.Enabled = draft && selected >= 0;
            eventCount.Text = "본문 " + count + "/24 · 사진 " + photos + "/8 · 텍스트/설명 " + chars + "/8000자"
                + (eventDirty ? " · 수정됨" : "");
            eventCount.ForeColor = chars > 8000 ? Theme.Danger : Theme.Muted;
        }

        private bool DiscardEventDraft()
        {
            return !eventDirty || MessageBox.Show(this, "저장하지 않은 이벤트 초안을 버릴까요?", "이벤트 편집",
                MessageBoxButtons.YesNo, MessageBoxIcon.Question) == DialogResult.Yes;
        }

        private void NewEvent()
        {
            if (!loggedIn || eventsBusy || !DiscardEventDraft()) return;
            EventEntry entry = new EventEntry();
            entry.Blocks.Add(new EventBlock());
            BindEventDraft(entry);
            SetEventNote("새 이벤트 · 썸네일을 선택하고 본문을 작성해 주세요. PNG/JPEG, 최대 6 MiB.", Theme.Muted);
            eventTitleBox.Focus();
        }

        private void EditSelectedEvent()
        {
            EventEntry entry = eventList.SelectedItem as EventEntry;
            if (!loggedIn || eventsBusy || entry == null || !DiscardEventDraft()) return;
            BindEventDraft(entry.Copy());
            SetEventNote("편집 중 · 텍스트/사진 순서와 기존 사진 경로가 함께 저장됩니다.", Theme.Muted);
        }

        private void BindEventDraft(EventEntry entry)
        {
            eventBinding = true;
            eventDraft = entry;
            editingEventBlock = null;
            eventTitleBox.Text = entry == null ? "" : entry.Title;
            eventBinding = false;
            eventDirty = false;
            RebuildEventBlocks(0);
            LoadEventPreview(eventThumbnailPreview, eventThumbnailNote,
                entry == null ? null : entry.ThumbnailPhoto, entry == null ? "" : entry.ThumbnailUrl);
            UpdateEventButtons();
        }

        private void RebuildEventBlocks(int selected)
        {
            eventBinding = true;
            eventBlockList.BeginUpdate();
            eventBlockList.Items.Clear();
            if (eventDraft != null)
                foreach (EventBlock block in eventDraft.Blocks) eventBlockList.Items.Add(block);
            if (eventBlockList.Items.Count > 0)
                eventBlockList.SelectedIndex = Math.Max(0, Math.Min(selected, eventBlockList.Items.Count - 1));
            eventBlockList.EndUpdate();
            eventBinding = false;
            SelectEventBlock();
        }

        private void SelectEventBlock()
        {
            editingEventBlock = eventBlockList.SelectedItem as EventBlock;
            eventBinding = true;
            bool image = editingEventBlock != null && editingEventBlock.Type == "image";
            eventBlockLabel.Text = image ? "사진 설명 (일반 텍스트 · 선택)" : "본문 텍스트 (HTML 없음)";
            eventTextBox.Text = editingEventBlock == null ? "" : (image ? editingEventBlock.Caption : editingEventBlock.Text);
            TableLayoutPanel editor = (TableLayoutPanel)eventTextBox.Parent;
            editor.RowStyles[1].Height = image ? 104f : 0f;
            eventImagePreview.Parent.Visible = image;
            eventBinding = false;
            LoadEventPreview(eventImagePreview, eventImageNote,
                image ? editingEventBlock.Photo : null, image ? editingEventBlock.PreviewUrl : "");
            UpdateEventButtons();
        }

        private void AddEventBlock(bool image)
        {
            if (!loggedIn || eventsBusy || eventDraft == null || eventDraft.Blocks.Count >= 24) return;
            EventPhoto photo = null;
            if (image)
            {
                int count = 0;
                foreach (EventBlock item in eventDraft.Blocks) if (item.Type == "image") count += 1;
                if (count >= 8) return;
                photo = PickEventPhoto();
                if (photo == null) return;
            }
            EventBlock block = new EventBlock();
            block.Type = image ? "image" : "text";
            block.Photo = photo;
            eventDraft.Blocks.Add(block);
            eventDirty = true;
            RebuildEventBlocks(eventDraft.Blocks.Count - 1);
            eventTextBox.Focus();
        }

        private void MoveEventBlock(int direction)
        {
            if (!loggedIn || eventsBusy || eventDraft == null) return;
            int index = eventBlockList.SelectedIndex;
            int target = index + direction;
            if (index < 0 || target < 0 || target >= eventDraft.Blocks.Count) return;
            EventBlock block = eventDraft.Blocks[index];
            eventDraft.Blocks.RemoveAt(index);
            eventDraft.Blocks.Insert(target, block);
            eventDirty = true;
            RebuildEventBlocks(target);
        }

        private void RemoveEventBlock()
        {
            if (!loggedIn || eventsBusy || eventDraft == null) return;
            int index = eventBlockList.SelectedIndex;
            if (index < 0) return;
            if (MessageBox.Show(this, "선택한 본문 블록을 삭제할까요?", "블록 삭제",
                MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes) return;
            eventDraft.Blocks.RemoveAt(index);
            eventDirty = true;
            RebuildEventBlocks(index);
        }

        private void ChooseEventPhoto(bool thumbnail)
        {
            if (!loggedIn || eventsBusy || eventDraft == null) return;
            if (!thumbnail && (editingEventBlock == null || editingEventBlock.Type != "image")) return;
            EventPhoto photo = PickEventPhoto();
            if (photo == null) return;
            if (thumbnail)
            {
                eventDraft.ThumbnailPhoto = photo;
                LoadEventPreview(eventThumbnailPreview, eventThumbnailNote, photo, "");
            }
            else
            {
                editingEventBlock.Photo = photo;
                LoadEventPreview(eventImagePreview, eventImageNote, photo, "");
            }
            eventDirty = true;
            UpdateEventButtons();
        }

        private EventPhoto PickEventPhoto()
        {
            using (OpenFileDialog dialog = new OpenFileDialog())
            {
                dialog.Title = "이벤트 사진 선택 · PNG/JPEG, 최대 6 MiB (WebP 미지원)";
                dialog.Filter = "PNG/JPEG 사진 (*.png;*.jpg;*.jpeg)|*.png;*.jpg;*.jpeg";
                dialog.CheckFileExists = true;
                if (dialog.ShowDialog(this) != DialogResult.OK) return null;
                try
                {
                    FileInfo info = new FileInfo(dialog.FileName);
                    if (info.Length == 0 || info.Length > 6 * 1024 * 1024) throw new EditorException("photo_too_large");
                    EventPhoto photo = new EventPhoto();
                    photo.Bytes = File.ReadAllBytes(dialog.FileName);
                    if (photo.Bytes.Length > 6 * 1024 * 1024) throw new EditorException("photo_too_large");
                    using (MemoryStream stream = new MemoryStream(photo.Bytes))
                    using (Image image = Image.FromStream(stream))
                    {
                        if (image.RawFormat.Guid == System.Drawing.Imaging.ImageFormat.Png.Guid) photo.ContentType = "image/png";
                        else if (image.RawFormat.Guid == System.Drawing.Imaging.ImageFormat.Jpeg.Guid) photo.ContentType = "image/jpeg";
                        else throw new EditorException("event_photo");
                        if ((long)image.Width * image.Height > 40000000) throw new EditorException("event_photo");
                    }
                    return photo;
                }
                catch (EditorException error) { SetEventNote(Messages.For(error), Theme.Danger); }
                catch { SetEventNote("사진을 읽을 수 없습니다. PNG/JPEG 파일을 확인해 주세요.", Theme.Danger); }
                return null;
            }
        }

        private static Image DecodeEventPreview(byte[] bytes)
        {
            using (MemoryStream stream = new MemoryStream(bytes))
            using (Image source = Image.FromStream(stream))
            {
                if ((long)source.Width * source.Height > 40000000) throw new EditorException("event_photo");
                double scale = Math.Min(1.0, Math.Min(480.0 / source.Width, 320.0 / source.Height));
                return new Bitmap(source, Math.Max(1, (int)(source.Width * scale)), Math.Max(1, (int)(source.Height * scale)));
            }
        }

        private void LoadEventPreview(PictureBox picture, Label note, EventPhoto photo, string url)
        {
            object marker = new object();
            picture.Tag = marker;
            Image previous = picture.Image;
            picture.Image = null;
            if (previous != null) previous.Dispose();
            note.Text = "PNG/JPEG · 최대 6 MiB (WebP 미리보기 미지원)";
            if (photo != null)
            {
                try { picture.Image = DecodeEventPreview(photo.Bytes); }
                catch { note.Text = "미리보기 불가 · 선택한 사진은 유지됩니다."; }
                return;
            }
            if (string.IsNullOrEmpty(url) || !IsHandleCreated) return;
            note.Text = "미리보기 불러오는 중…";
            Thread worker = new Thread(delegate()
            {
                Image loaded = null;
                try
                {
                    // Public image endpoint only; never forward the administrator token.
                    HttpWebRequest request = (HttpWebRequest)WebRequest.Create(url);
                    request.Timeout = 10000;
                    request.ReadWriteTimeout = 10000;
                    using (WebResponse response = request.GetResponse())
                    using (Stream input = response.GetResponseStream())
                    using (MemoryStream buffer = new MemoryStream())
                    {
                        byte[] chunk = new byte[8192];
                        int read;
                        while ((read = input.Read(chunk, 0, chunk.Length)) > 0)
                        {
                            if (buffer.Length + read > 6 * 1024 * 1024) throw new EditorException("photo_too_large");
                            buffer.Write(chunk, 0, read);
                        }
                        loaded = DecodeEventPreview(buffer.ToArray());
                    }
                }
                catch (WebException error) { if (error.Response != null) error.Response.Close(); }
                catch { }
                Image result = loaded;
                try
                {
                    BeginInvoke(new MethodInvoker(delegate
                    {
                        if (IsDisposed || picture.IsDisposed || picture.Tag != marker)
                        {
                            if (result != null) result.Dispose();
                            return;
                        }
                        picture.Image = result;
                        note.Text = result == null ? "미리보기 불가 (WebP/연결 확인) · 기존 사진 유지" : "기존 사진 · 경로 유지";
                    }));
                }
                catch { if (result != null) result.Dispose(); }
            });
            worker.IsBackground = true;
            worker.Start();
        }

        private void RefreshEventList(string selectedId)
        {
            eventList.BeginUpdate();
            eventList.Items.Clear();
            foreach (EventEntry entry in events)
            {
                int index = eventList.Items.Add(entry);
                if (entry.Id == selectedId) eventList.SelectedIndex = index;
            }
            eventList.EndUpdate();
            UpdateEventButtons();
        }

        private void RunEventAction(string message, Action<EditorApi> action, MethodInvoker completed)
        {
            if (!loggedIn || eventsBusy || api.Token.Length == 0) return;
            eventsBusy = true;
            int version = eventSessionVersion;
            EditorApi client = new EditorApi(api.BaseUrl);
            client.Token = api.Token;
            tabPanels[6].Enabled = false;
            foreach (TabButton button in tabButtons) button.Enabled = false;
            Cursor = Cursors.WaitCursor;
            SetEventNote(message, Theme.Muted);
            Thread worker = new Thread(delegate()
            {
                string failure = null;
                try { action(client); }
                catch (EditorException error) { failure = Messages.For(error); }
                catch { failure = "요청을 완료하지 못했습니다. 네트워크를 확인해 주세요."; }
                string errorText = failure;
                try
                {
                    BeginInvoke(new MethodInvoker(delegate
                    {
                        if (IsDisposed || version != eventSessionVersion) return;
                        eventsBusy = false;
                        tabPanels[6].Enabled = loggedIn;
                        foreach (TabButton button in tabButtons) button.Enabled = true;
                        Cursor = Cursors.Default;
                        if (errorText == null) completed();
                        else SetEventNote(errorText + " 초안은 유지됩니다.", Theme.Danger);
                        UpdateEventButtons();
                    }));
                }
                catch { /* The window closed while the request was running. */ }
            });
            worker.IsBackground = true;
            worker.Start();
        }

        private void LoadEvents()
        {
            EventEntry selected = eventList.SelectedItem as EventEntry;
            string selectedId = selected == null ? "" : selected.Id;
            List<EventEntry> loaded = null;
            RunEventAction("이벤트 목록을 불러오는 중…", delegate(EditorApi client) { loaded = client.Events(); }, delegate
            {
                events.Clear();
                events.AddRange(loaded);
                eventsLoaded = true;
                RefreshEventList(selectedId);
                SetEventNote("이벤트 " + events.Count + "개 · 목록을 새로 불러왔습니다. 편집 중인 초안은 유지됩니다.", Theme.Muted);
            });
        }

        private void SaveEventDraft()
        {
            if (!loggedIn || eventsBusy || eventDraft == null) return;
            try { EditorApi.ValidateEvent(eventDraft); }
            catch (EditorException error) { SetEventNote(Messages.For(error), Theme.Danger); return; }
            EventEntry draft = eventDraft;
            EventEntry saved = null;
            RunEventAction("사진 업로드 및 이벤트 저장 중…", delegate(EditorApi client) { saved = client.SaveEvent(draft); }, delegate
            {
                int index = events.FindIndex(delegate(EventEntry entry) { return entry.Id == saved.Id; });
                if (index < 0) events.Insert(0, saved);
                else events[index] = saved;
                RefreshEventList(saved.Id);
                BindEventDraft(saved.Copy());
                SetEventNote("이벤트를 저장했습니다. 홈페이지에 반영됩니다.", Theme.Ok);
            });
        }

        private void DeleteSelectedEvent()
        {
            EventEntry selected = eventList.SelectedItem as EventEntry;
            if (!loggedIn || eventsBusy || selected == null) return;
            string question = "선택한 이벤트를 삭제할까요?\n" + selected.Title;
            if (eventDraft != null && eventDraft.Id == selected.Id && eventDirty)
                question += "\n이 이벤트의 저장하지 않은 초안도 삭제됩니다.";
            if (MessageBox.Show(this, question, "이벤트 삭제", MessageBoxButtons.YesNo, MessageBoxIcon.Warning) != DialogResult.Yes) return;
            RunEventAction("이벤트를 삭제하는 중…", delegate(EditorApi client) { client.DeleteEvent(selected.Id); }, delegate
            {
                events.RemoveAll(delegate(EventEntry entry) { return entry.Id == selected.Id; });
                if (eventDraft != null && eventDraft.Id == selected.Id) BindEventDraft(null);
                RefreshEventList("");
                SetEventNote("이벤트를 삭제했습니다.", Theme.Ok);
            });
        }

        private void ResetEvents()
        {
            eventSessionVersion += 1;
            eventsBusy = false;
            eventsLoaded = false;
            events.Clear();
            eventList.Items.Clear();
            BindEventDraft(null);
            tabPanels[6].Enabled = false;
            foreach (TabButton button in tabButtons) button.Enabled = true;
            Cursor = Cursors.Default;
            SetEventNote("새 이벤트를 만들거나 목록에서 선택 후 편집해 주세요.", Theme.Muted);
        }

        protected override void OnFormClosed(FormClosedEventArgs e)
        {
            eventSessionVersion += 1;
            eventThumbnailPreview.Tag = null;
            eventImagePreview.Tag = null;
            if (eventThumbnailPreview.Image != null) eventThumbnailPreview.Image.Dispose();
            if (eventImagePreview.Image != null) eventImagePreview.Image.Dispose();
            base.OnFormClosed(e);
        }

        private Control BuildFooter()
        {
            Panel footer = new Panel();
            footer.Dock = DockStyle.Fill;
            footer.BackColor = Theme.Panel;
            footer.Padding = new Padding(24, 12, 24, 14);

            TableLayoutPanel grid = new TableLayoutPanel();
            grid.Dock = DockStyle.Fill;
            grid.ColumnCount = 3;
            grid.RowCount = 1;
            grid.BackColor = Theme.Panel;
            grid.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
            grid.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 118f));
            grid.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 88f));
            footer.Controls.Add(grid);

            footerNote = MakeNote();
            footerNote.Dock = DockStyle.Fill;
            footerNote.TextAlign = ContentAlignment.MiddleLeft;
            grid.Controls.Add(footerNote, 0, 0);

            reloadButton = MakeButton("다시 불러오기", false);
            reloadButton.Dock = DockStyle.Fill;
            reloadButton.Margin = new Padding(4, 0, 4, 0);
            reloadButton.Click += delegate { LoadContent(true); };
            grid.Controls.Add(reloadButton, 1, 0);

            saveButton = MakeButton("저장", true);
            saveButton.Dock = DockStyle.Fill;
            saveButton.Margin = new Padding(4, 0, 0, 0);
            saveButton.Click += delegate { Save(); };
            grid.Controls.Add(saveButton, 2, 0);

            return footer;
        }

        private void AddFieldRow(
            TableLayoutPanel grid, int row, string leftKey, string leftLabel,
            string rightKey, string rightLabel)
        {
            grid.Controls.Add(MakeLabel(leftLabel), 0, row);
            TextBox leftBox = MakeInput(false);
            fields[leftKey] = leftBox;
            grid.Controls.Add(leftBox, 1, row);

            Label right = MakeLabel(rightLabel);
            right.Margin = new Padding(14, 8, 0, 6);
            grid.Controls.Add(right, 2, row);
            TextBox rightBox = MakeInput(false);
            fields[rightKey] = rightBox;
            grid.Controls.Add(rightBox, 3, row);
        }

        private static Label MakeLabel(string text)
        {
            Label label = new Label();
            label.Text = text;
            label.Font = Theme.Small();
            label.ForeColor = Theme.Muted;
            label.AutoSize = true;
            label.Anchor = AnchorStyles.Left;
            label.Margin = new Padding(0, 8, 0, 6);
            return label;
        }

        private static TextBox MakeInput(bool password)
        {
            TextBox box = new TextBox();
            box.Dock = DockStyle.Fill;
            box.BorderStyle = BorderStyle.FixedSingle;
            box.BackColor = Theme.Field;
            box.ForeColor = Theme.Text;
            box.Font = Theme.Body();
            box.Margin = new Padding(0, 4, 0, 6);
            if (password) box.UseSystemPasswordChar = true;
            return box;
        }

        private static Button MakeButton(string text, bool primary)
        {
            Button button = new Button();
            button.Text = text;
            button.FlatStyle = FlatStyle.Flat;
            button.FlatAppearance.BorderSize = 1;
            button.FlatAppearance.BorderColor = primary ? Theme.Accent : Theme.Border;
            button.FlatAppearance.MouseOverBackColor = primary
                ? ColorTranslator.FromHtml("#F0C776")
                : ColorTranslator.FromHtml("#1B2230");
            button.BackColor = primary ? Theme.Accent : Theme.Field;
            button.ForeColor = primary ? ColorTranslator.FromHtml("#15100A") : Theme.Text;
            button.Font = Theme.Bold(9.5f);
            button.Height = 34;
            button.Cursor = Cursors.Hand;
            button.UseVisualStyleBackColor = false;
            button.Margin = new Padding(0, 4, 0, 0);
            return button;
        }

        private static Label MakeNote()
        {
            Label note = new Label();
            note.Text = "";
            note.Font = Theme.Small();
            note.ForeColor = Theme.Muted;
            note.AutoSize = true;
            note.Margin = new Padding(0);
            return note;
        }

        private void SetConnectNote(string text, Color color)
        {
            connectNote.Text = text;
            connectNote.ForeColor = color;
        }

        private void SetFooterNote(string text, Color color)
        {
            footerNote.Text = text;
            footerNote.ForeColor = color;
        }

        private void SetMemberNote(string text, Color color)
        {
            memberNote.Text = text;
            memberNote.ForeColor = color;
        }

        private void SetVerifyNote(string text, Color color)
        {
            if (verifyNote == null) return;
            verifyNote.Text = text;
            verifyNote.ForeColor = color;
        }

        private void SetMailNote(string text, Color color)
        {
            mailNote.Text = text;
            mailNote.ForeColor = color;
        }

        private void SetMailSettingsNote(string text, Color color)
        {
            mailSettingsNote.Text = text;
            mailSettingsNote.ForeColor = color;
        }

        private void SwitchTab(int index)
        {
            if (eventsBusy) return;
            if (index < 0 || index >= tabPanels.Length) index = 0;
            if (!loggedIn && index > 0)
            {
                index = 0;
                SetFooterNote("로그인 후 이용할 수 있습니다.", Theme.Danger);
            }
            for (int i = 0; i < tabButtons.Length; i += 1)
            {
                tabButtons[i].Active = i == index;
                tabButtons[i].Locked = !loggedIn && i > 0;
                tabButtons[i].Invalidate();
                tabPanels[i].Visible = i == index;
            }
            bool configTab = index == 1 || index == 2;
            saveButton.Enabled = loggedIn && configTab;
            reloadButton.Enabled = loggedIn && configTab;
            if (index == 3 && loggedIn) LoadMembers(false);
            if (index == 4 && loggedIn) LoadVerify();
            if (index == 5 && loggedIn && !mailLoaded) LoadMail(false);
            if (index == 6 && loggedIn && !eventsLoaded) LoadEvents();
        }

        private void SetLoggedIn(bool on)
        {
            loggedIn = on;
            loginForm.Visible = !on;
            sessionCard.Visible = on;
            sessionLabel.Text = on ? adminNickname + " · 관리자" : "로그인 전";
            if (!on)
            {
                members.Clear();
                RefreshMemberView();
                mailLoaded = false;
                ResetEvents();
                SwitchTab(0);
            }
            else
            {
                tabPanels[6].Enabled = !eventsBusy;
                UpdateEventButtons();
                SwitchTab(1);
            }
        }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            if (!restoreSession) return;
            string site = Session.LoadSite();
            siteBox.Text = site.Length > 0 ? site : "https://dimension-mc-wvlzuyrjbqi.qoder.website";
            string savedUsername = Session.LoadUsername();
            if (savedUsername.Length > 0) userBox.Text = savedUsername;
            string token = Session.LoadToken();
            SetLoggedIn(false);
            if (token.Length > 0)
            {
                api.BaseUrl = EditorApi.Normalize(siteBox.Text);
                api.Token = token;
                SetConnectNote("저장된 로그인으로 연결하는 중…", Theme.Muted);
                LoadContent(false);
            }
            if (!loggedIn) userBox.Focus();
        }

        private void Login()
        {
            string site = EditorApi.Normalize(siteBox.Text);
            string username = userBox.Text.Trim();
            string password = passBox.Text;
            if (site.Length == 0)
            {
                SetConnectNote("사이트 주소를 입력해 주세요.", Theme.Danger);
                return;
            }
            if (username.Length == 0 || password.Length == 0)
            {
                SetConnectNote("아이디와 비밀번호를 입력해 주세요.", Theme.Danger);
                return;
            }

            api.BaseUrl = site;
            api.Token = "";
            loginButton.Enabled = false;
            Cursor = Cursors.WaitCursor;
            SetConnectNote("로그인 중…", Theme.Muted);
            try
            {
                adminNickname = api.Login(username, password);
                adminUsername = api.LastUsername.Length > 0 ? api.LastUsername : username;
                passBox.Text = "";
                Session.Save(site, rememberBox.Checked ? api.Token : "", username);
                SetConnectNote("", Theme.Muted);
                LoadContent(true);
            }
            catch (EditorException error)
            {
                SetConnectNote(Messages.For(error), Theme.Danger);
            }
            catch
            {
                SetConnectNote("사이트에 연결하지 못했습니다. 주소와 네트워크를 확인해 주세요.", Theme.Danger);
            }
            finally
            {
                Cursor = Cursors.Default;
                loginButton.Enabled = true;
            }
        }

        private void LoadContent(bool announce)
        {
            if (api.Token.Length == 0) return;
            Cursor = Cursors.WaitCursor;
            if (announce) SetFooterNote("불러오는 중…", Theme.Muted);
            try
            {
                Dictionary<string, object> data = api.Content();
                Dictionary<string, object> config = data["config"] as Dictionary<string, object>;
                if (config == null) throw new EditorException("invalid_response");
                adminNickname = EditorApi.Nickname(data);
                string loadedUsername = EditorApi.Username(data);
                if (loadedUsername.Length > 0) adminUsername = loadedUsername;
                FillForm(config);
                SetLoggedIn(true);
                SetConnectNote("", Theme.Muted);
                SetFooterNote(announce ? "불러왔습니다." : "", Theme.Muted);
            }
            catch (EditorException error)
            {
                if (error.Code == "login_required" || error.Code == "invalid_credentials")
                {
                    ClearToken();
                    SetLoggedIn(false);
                    SetConnectNote("저장된 로그인이 만료되었습니다. 비밀번호를 입력해 주세요.", Theme.Danger);
                }
                else if (announce)
                {
                    SetFooterNote(Messages.For(error), Theme.Danger);
                }
                else
                {
                    SetConnectNote(Messages.For(error), Theme.Danger);
                }
            }
            catch
            {
                if (announce) SetFooterNote("사이트에 연결하지 못했습니다. 주소와 네트워크를 확인해 주세요.", Theme.Danger);
            }
            finally
            {
                Cursor = Cursors.Default;
            }
        }

        private void FillForm(Dictionary<string, object> config)
        {
            foreach (string key in FieldKeys)
            {
                object value;
                TextBox box;
                if (fields.TryGetValue(key, out box))
                {
                    box.Text = config.TryGetValue(key, out value) && value is string ? (string)value : "";
                }
            }

            cards.Clear();
            object raw;
            if (config.TryGetValue("world_cards", out raw) && raw is string)
            {
                cards.AddRange(ParseCards((string)raw));
            }
            RebuildCards();
        }

        private List<WorldCard> ParseCards(string json)
        {
            List<WorldCard> result = new List<WorldCard>();
            if (string.IsNullOrEmpty(json)) return result;
            try
            {
                JavaScriptSerializer serializer = new JavaScriptSerializer();
                object parsed = serializer.DeserializeObject(json);
                object[] items = parsed as object[];
                if (items == null) return result;
                foreach (object item in items)
                {
                    Dictionary<string, object> map = item as Dictionary<string, object>;
                    if (map == null) continue;
                    WorldCard card = new WorldCard();
                    card.Icon = ReadIcon(map);
                    card.Title = ReadString(map, "title");
                    card.Text = ReadString(map, "text");
                    result.Add(card);
                    if (result.Count >= 16) break;
                }
            }
            catch
            {
                result.Clear();
            }
            return result;
        }

        private static string ReadIcon(Dictionary<string, object> map)
        {
            string icon = ReadString(map, "icon");
            foreach (string name in IconNames)
            {
                if (name == icon) return icon;
            }
            return "Sparkles";
        }

        private static string ReadString(Dictionary<string, object> map, string key)
        {
            object value;
            if (map.TryGetValue(key, out value) && value is string) return (string)value;
            return "";
        }

        private void RebuildCards()
        {
            cardHost.SuspendLayout();
            while (cardHost.Controls.Count > 0)
            {
                Control child = cardHost.Controls[0];
                cardHost.Controls.RemoveAt(0);
                child.Dispose();
            }
            cardHost.RowStyles.Clear();
            cardHost.RowCount = Math.Max(1, cards.Count);

            if (cards.Count == 0)
            {
                Label empty = new Label();
                empty.Text = "카드가 없습니다. '+ 카드 추가'로 카드를 만들어 주세요.";
                empty.Font = Theme.Small();
                empty.ForeColor = Theme.Muted;
                empty.AutoSize = true;
                empty.Margin = new Padding(0, 4, 0, 4);
                cardHost.Controls.Add(empty, 0, 0);
            }
            else
            {
                for (int index = 0; index < cards.Count; index += 1)
                {
                    cardHost.RowStyles.Add(new RowStyle(SizeType.AutoSize));
                    cardHost.Controls.Add(BuildCardRow(cards[index], index), 0, index);
                }
            }

            cardCount.Text = cards.Count + " / 16";
            addCardButton.Enabled = cards.Count < 16 && loggedIn;
            cardHost.ResumeLayout(true);
        }

        private Control BuildCardRow(WorldCard card, int index)
        {
            TableLayoutPanel row = new TableLayoutPanel();
            row.ColumnCount = 2;
            row.AutoSize = true;
            row.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            row.Anchor = AnchorStyles.Left | AnchorStyles.Right;
            row.BackColor = Theme.PanelAlt;
            row.Padding = new Padding(14, 10, 14, 12);
            row.Margin = new Padding(0, 0, 0, 10);
            row.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
            row.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 236f));

            Label order = new Label();
            order.Text = (index + 1) + "번째 카드";
            order.Font = Theme.Small();
            order.ForeColor = Theme.Muted;
            order.AutoSize = true;
            order.Margin = new Padding(0, 2, 0, 8);
            row.Controls.Add(order, 0, 0);

            Button remove = MakeButton("삭제", false);
            remove.Height = 26;
            remove.Anchor = AnchorStyles.Right;
            remove.Margin = new Padding(0, 0, 0, 8);
            remove.ForeColor = Theme.Danger;
            remove.FlatAppearance.BorderColor = Theme.Danger;
            int captured = index;
            remove.Click += delegate
            {
                if (captured < cards.Count)
                {
                    cards.RemoveAt(captured);
                    RebuildCards();
                    SetFooterNote("카드를 삭제했습니다. 저장하면 홈페이지에 반영됩니다.", Theme.Muted);
                }
            };
            row.Controls.Add(remove, 1, 0);

            Label titleLabel = MakeLabel("제목");
            titleLabel.Margin = new Padding(0, 0, 0, 4);
            row.Controls.Add(titleLabel, 0, 1);

            Label iconLabel = MakeLabel("아이콘");
            iconLabel.Margin = new Padding(14, 0, 0, 4);
            row.Controls.Add(iconLabel, 1, 1);

            TextBox titleBox = MakeInput(false);
            titleBox.MaxLength = 24;
            titleBox.Text = card.Title;
            titleBox.Margin = new Padding(0, 0, 14, 8);
            titleBox.TextChanged += delegate { card.Title = titleBox.Text; };
            row.Controls.Add(titleBox, 0, 2);

            ComboBox iconBox = new ComboBox();
            iconBox.DropDownStyle = ComboBoxStyle.DropDownList;
            iconBox.FlatStyle = FlatStyle.Flat;
            iconBox.BackColor = Theme.Field;
            iconBox.ForeColor = Theme.Text;
            iconBox.Font = Theme.Body();
            iconBox.Anchor = AnchorStyles.Left | AnchorStyles.Right;
            iconBox.Margin = new Padding(0, 0, 0, 8);
            foreach (string name in IconNames)
            {
                string label;
                if (!IconLabels.TryGetValue(name, out label)) label = name;
                iconBox.Items.Add(new IconItem(name, label));
            }
            iconBox.SelectedIndex = IconIndex(card.Icon);
            iconBox.SelectedIndexChanged += delegate
            {
                IconItem item = iconBox.SelectedItem as IconItem;
                if (item != null) card.Icon = item.Name;
            };
            row.Controls.Add(iconBox, 1, 2);

            Label textLabel = MakeLabel("설명");
            textLabel.Margin = new Padding(0, 0, 0, 4);
            row.Controls.Add(textLabel, 0, 3);
            row.SetColumnSpan(textLabel, 2);

            TextBox textBox = MakeInput(false);
            textBox.MaxLength = 90;
            textBox.Text = card.Text;
            textBox.Margin = new Padding(0, 0, 0, 0);
            textBox.TextChanged += delegate { card.Text = textBox.Text; };
            row.Controls.Add(textBox, 0, 4);
            row.SetColumnSpan(textBox, 2);

            return row;
        }

        private static int IconIndex(string name)
        {
            for (int index = 0; index < IconNames.Length; index += 1)
            {
                if (IconNames[index] == name) return index;
            }
            return 0;
        }

        private void Save()
        {
            if (api.Token.Length == 0 || !loggedIn) return;

            Dictionary<string, string> values = new Dictionary<string, string>();
            foreach (string key in FieldKeys)
            {
                TextBox box;
                if (fields.TryGetValue(key, out box)) values[key] = box.Text.Trim();
            }

            string portError = ValidatePorts(values);
            if (portError != null)
            {
                SetFooterNote(portError, Theme.Danger);
                return;
            }
            if (values["discord_url"].Length > 0
                && !values["discord_url"].StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                SetFooterNote("디스코드 링크는 https://로 시작해야 합니다.", Theme.Danger);
                return;
            }

            List<Dictionary<string, string>> clean = new List<Dictionary<string, string>>();
            foreach (WorldCard card in cards)
            {
                string title = (card.Title ?? "").Trim();
                string text = (card.Text ?? "").Trim();
                if (title.Length == 0 || text.Length == 0)
                {
                    SetFooterNote("제목과 설명이 비어 있는 카드가 있습니다.", Theme.Danger);
                    return;
                }
                if (title.Length > 24)
                {
                    SetFooterNote("카드 제목은 24자까지 입력할 수 있습니다.", Theme.Danger);
                    return;
                }
                if (text.Length > 90)
                {
                    SetFooterNote("카드 설명은 90자까지 입력할 수 있습니다.", Theme.Danger);
                    return;
                }
                Dictionary<string, string> item = new Dictionary<string, string>();
                item["icon"] = card.Icon;
                item["title"] = title;
                item["text"] = text;
                clean.Add(item);
            }

            JavaScriptSerializer serializer = new JavaScriptSerializer();
            values["world_cards"] = clean.Count == 0 ? "" : serializer.Serialize(clean);

            saveButton.Enabled = false;
            Cursor = Cursors.WaitCursor;
            SetFooterNote("저장 중…", Theme.Muted);
            try
            {
                Dictionary<string, object> data = api.Save(values);
                Dictionary<string, object> config = data["config"] as Dictionary<string, object>;
                if (config != null) FillForm(config);
                SetFooterNote("저장했습니다. 홈페이지에 반영됩니다.", Theme.Ok);
                sessionLabel.Text = adminNickname + " · 관리자";
            }
            catch (EditorException error)
            {
                if (error.Code == "login_required" || error.Code == "invalid_credentials")
                {
                    ClearToken();
                    SetLoggedIn(false);
                    SetConnectNote("로그인이 만료되었습니다. 다시 로그인해 주세요.", Theme.Danger);
                }
                else
                {
                    SetFooterNote(Messages.For(error), Theme.Danger);
                }
            }
            catch
            {
                SetFooterNote("저장하지 못했습니다. 네트워크를 확인해 주세요.", Theme.Danger);
            }
            finally
            {
                Cursor = Cursors.Default;
                saveButton.Enabled = api.Token.Length > 0;
            }
        }

        private static string ValidatePorts(Dictionary<string, string> values)
        {
            string[] keys = new string[] { "java_port", "bedrock_port" };
            string[] labels = new string[] { "Java 포트", "Bedrock 포트" };
            for (int index = 0; index < keys.Length; index += 1)
            {
                string value = values[keys[index]];
                if (value.Length == 0) continue;
                if (value.Length > 5) return labels[index] + "는 5자리 숫자까지 입력할 수 있습니다.";
                foreach (char ch in value)
                {
                    if (ch < '0' || ch > '9') return labels[index] + "는 숫자만 입력할 수 있습니다.";
                }
            }
            return null;
        }

        private void LoadMembers(bool announce)
        {
            if (api.Token.Length == 0) return;
            Cursor = Cursors.WaitCursor;
            if (announce) SetMemberNote("회원 목록을 불러오는 중…", Theme.Muted);
            try
            {
                List<Member> loaded = api.Members();
                members.Clear();
                members.AddRange(loaded);
                RefreshMemberView();
                if (announce) SetMemberNote("회원 목록을 불러왔습니다.", Theme.Ok);
            }
            catch (EditorException error)
            {
                if (!HandleExpired(error))
                {
                    SetMemberNote(Messages.For(error), Theme.Danger);
                    SetVerifyNote(Messages.For(error), Theme.Danger);
                }
            }
            catch
            {
                SetMemberNote("회원 목록을 불러오지 못했습니다. 네트워크를 확인해 주세요.", Theme.Danger);
                SetVerifyNote("회원 목록을 불러오지 못했습니다. 네트워크를 확인해 주세요.", Theme.Danger);
            }
            finally
            {
                Cursor = Cursors.Default;
            }
        }

        private void ClearToken()
        {
            api.Token = "";
            // Keep the site and username so the next sign-in is one field away.
            Session.Save(EditorApi.Normalize(siteBox.Text), "", userBox.Text.Trim());
        }

        private bool HandleExpired(EditorException error)
        {
            if (error.Code != "login_required" && error.Code != "invalid_credentials") return false;
            ClearToken();
            SetLoggedIn(false);
            SetConnectNote("로그인이 만료되었습니다. 다시 로그인해 주세요.", Theme.Danger);
            return true;
        }

        private void RefreshMemberView()
        {
            if (memberGrid == null) return;
            string query = (memberSearch.Text ?? "").Trim().ToLower(CultureInfo.InvariantCulture);
            string filter = memberFilter.SelectedItem as string ?? "전체";

            List<Member> visible = new List<Member>();
            foreach (Member member in members)
            {
                if (filter == "모험가" && member.IsAdmin()) continue;
                if (filter == "관리자" && !member.IsAdmin()) continue;
                if (filter == "정지" && member.Status != "suspended") continue;
                if (filter == "제한" && member.Status != "restricted") continue;
                if (query.Length > 0
                    && member.Nickname.ToLower(CultureInfo.InvariantCulture).IndexOf(query, StringComparison.Ordinal) < 0
                    && member.Username.ToLower(CultureInfo.InvariantCulture).IndexOf(query, StringComparison.Ordinal) < 0)
                {
                    continue;
                }
                visible.Add(member);
            }

            string keepId = selectedMember != null ? selectedMember.Id : "";
            memberGrid.Rows.Clear();
            foreach (Member member in visible)
            {
                int index = memberGrid.Rows.Add(
                    member.Nickname,
                    member.Username,
                    member.Email.Length > 0 ? member.Email : "미등록",
                    member.IsAdmin() ? "관리자" : "모험가",
                    StatusText(member),
                    FormatDate(member.CreatedAt));
                memberGrid.Rows[index].Tag = member;
            }
            memberCount.Text = visible.Count + "명 / 전체 " + members.Count + "명";

            selectedMember = null;
            if (keepId.Length > 0)
            {
                foreach (DataGridViewRow row in memberGrid.Rows)
                {
                    Member member = row.Tag as Member;
                    if (member != null && member.Id == keepId)
                    {
                        row.Selected = true;
                        selectedMember = member;
                        break;
                    }
                }
            }
            ShowSelectedMember();
            RefreshVerifyView();
        }

        private static string StatusText(Member member)
        {
            if (member.Status == "suspended")
            {
                return member.SanctionUntil.Length > 0
                    ? "정지 ~ " + FormatDate(member.SanctionUntil)
                    : "정지 (무기한)";
            }
            if (member.Status == "restricted")
            {
                return member.SanctionUntil.Length > 0
                    ? "제한 ~ " + FormatDate(member.SanctionUntil)
                    : "제한 (무기한)";
            }
            return "정상";
        }

        private static string FormatDate(string iso)
        {
            if (string.IsNullOrEmpty(iso)) return "";
            DateTime parsed;
            if (DateTime.TryParse(
                iso,
                CultureInfo.InvariantCulture,
                DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal,
                out parsed))
            {
                return parsed.ToLocalTime().ToString("yyyy. MM. dd", CultureInfo.InvariantCulture);
            }
            return iso;
        }

        private void ShowSelectedMember()
        {
            if (memberGrid == null) return;
            if (memberGrid.SelectedRows.Count > 0)
            {
                selectedMember = memberGrid.SelectedRows[0].Tag as Member;
            }
            Member member = selectedMember;
            bool exists = member != null;
            bool admin = exists && member.IsAdmin();
            bool self = exists && member.Username.Length > 0
                && (adminUsername.Length > 0 ? member.Username == adminUsername : member.Username == userBox.Text.Trim());

            if (!exists)
            {
                memberDetail.Text = "목록에서 회원을 선택하세요.";
                roleButton.Enabled = false;
                suspendButton.Enabled = false;
                restrictButton.Enabled = false;
                clearButton.Enabled = false;
                sanctionReason.Enabled = false;
                sanctionDays.Enabled = false;
                return;
            }

            string extra = member.Status != "active"
                ? " · " + StatusText(member) + (member.SanctionReason.Length > 0 ? " · " + member.SanctionReason : "")
                : "";
            memberDetail.Text = member.Nickname + " @" + member.Username
                + (admin ? " · 관리자" : " · 모험가")
                + (member.Verified ? " · 승인됨" : " · 승인 대기")
                + extra + "\n" + member.EmailText();

            roleButton.Text = admin ? "관리자 해제" : "관리자 지정";
            roleButton.Enabled = !self;
            bool sanctionable = !admin && !self;
            sanctionReason.Enabled = sanctionable;
            sanctionDays.Enabled = sanctionable;
            suspendButton.Enabled = sanctionable;
            restrictButton.Enabled = sanctionable;
            clearButton.Enabled = sanctionable && member.Status != "active";
        }

        private void ChangeRole()
        {
            if (selectedMember == null) return;
            Member target = selectedMember;
            Dictionary<string, object> payload = new Dictionary<string, object>();
            payload["role"] = target.IsAdmin() ? "user" : "admin";
            ApplyMemberUpdate(
                target,
                payload,
                target.IsAdmin() ? "관리자 권한을 해제했습니다." : "관리자로 지정했습니다.",
                "권한을 변경하지 못했습니다.");
        }

        private void Sanction(string status)
        {
            if (selectedMember == null) return;
            Member target = selectedMember;
            Dictionary<string, object> payload = new Dictionary<string, object>();
            payload["status"] = status;
            if (status != "active")
            {
                int days = SanctionDaysValue();
                payload["days"] = days > 0 ? (object)days : null;
                payload["reason"] = sanctionReason.Text.Trim();
            }
            string done = status == "suspended"
                ? "정지했습니다."
                : status == "restricted" ? "제한했습니다." : "제재를 해제했습니다.";
            ApplyMemberUpdate(target, payload, done, "제재를 적용하지 못했습니다.");
        }

        private int SanctionDaysValue()
        {
            switch (sanctionDays.SelectedIndex)
            {
                case 0: return 1;
                case 1: return 7;
                case 2: return 30;
                default: return 0;
            }
        }

        private void ApplyMemberUpdate(
            Member target, Dictionary<string, object> payload, string success, string failure)
        {
            Cursor = Cursors.WaitCursor;
            SetMemberNote("적용 중…", Theme.Muted);
            try
            {
                Member updated = api.UpdateMember(target.Id, payload);
                for (int index = 0; index < members.Count; index += 1)
                {
                    if (members[index].Id == updated.Id)
                    {
                        members[index] = updated;
                        break;
                    }
                }
                selectedMember = updated;
                sanctionReason.Text = "";
                RefreshMemberView();
                SetMemberNote(success, Theme.Ok);
            }
            catch (EditorException error)
            {
                if (!HandleExpired(error)) SetMemberNote(Messages.For(error), Theme.Danger);
            }
            catch
            {
                SetMemberNote(failure, Theme.Danger);
            }
            finally
            {
                Cursor = Cursors.Default;
            }
        }

        private void LoadVerify()
        {
            if (api.Token.Length == 0) return;
            SetVerifyNote("불러오는 중…", Theme.Muted);
            LoadMembers(false);
        }

        private void RefreshVerifyView()
        {
            if (verifyGrid == null) return;
            string keepId = verifySelected != null ? verifySelected.Id : "";
            int pending = 0;
            verifyGrid.Rows.Clear();
            foreach (Member member in members)
            {
                if (member.Verified) continue;
                int index = verifyGrid.Rows.Add(
                    member.Nickname,
                    member.Username,
                    member.Email.Length > 0 ? member.Email : "미등록",
                    FormatDate(member.CreatedAt));
                verifyGrid.Rows[index].Tag = member;
                if (member.Id == keepId) verifyGrid.Rows[index].Selected = true;
            }
            foreach (DataGridViewRow row in verifyGrid.Rows)
            {
                if (row.Tag is Member) pending += 1;
            }
            verifySelected = verifyGrid.SelectedRows.Count > 0
                ? verifyGrid.SelectedRows[0].Tag as Member
                : null;
            verifyCount.Text = "대기 " + pending + "명";
            verifyApproveButton.Enabled = verifySelected != null;
            SetVerifyNote(
                pending == 0
                    ? "대기 중인 인증 요청이 없습니다."
                    : "승인할 회원을 선택한 뒤 인증 승인을 누르세요.",
                Theme.Muted);
        }

        private void ShowSelectedVerify()
        {
            if (verifyGrid == null) return;
            verifySelected = verifyGrid.SelectedRows.Count > 0
                ? verifyGrid.SelectedRows[0].Tag as Member
                : null;
            if (verifyApproveButton != null) verifyApproveButton.Enabled = verifySelected != null;
        }

        private void ApproveVerify()
        {
            if (verifySelected == null) return;
            Member target = verifySelected;
            Dictionary<string, object> payload = new Dictionary<string, object>();
            payload["verified"] = true;
            Cursor = Cursors.WaitCursor;
            verifyApproveButton.Enabled = false;
            SetVerifyNote("승인하는 중…", Theme.Muted);
            try
            {
                Member updated = api.UpdateMember(target.Id, payload);
                for (int index = 0; index < members.Count; index += 1)
                {
                    if (members[index].Id == updated.Id)
                    {
                        members[index] = updated;
                        break;
                    }
                }
                verifySelected = null;
                RefreshMemberView();
                SetVerifyNote(updated.Nickname + " 님을 승인했습니다. 이제 채팅에 참여할 수 있습니다.", Theme.Ok);
            }
            catch (EditorException error)
            {
                if (!HandleExpired(error)) SetVerifyNote(Messages.For(error), Theme.Danger);
            }
            catch
            {
                SetVerifyNote("승인하지 못했습니다. 네트워크를 확인해 주세요.", Theme.Danger);
            }
            finally
            {
                Cursor = Cursors.Default;
                verifyApproveButton.Enabled = verifySelected != null;
            }
        }

        private void LoadMail(bool announce)
        {
            if (api.Token.Length == 0) return;
            Cursor = Cursors.WaitCursor;
            if (announce) SetMailNote("불러오는 중…", Theme.Muted);
            try
            {
                Dictionary<string, object> data = api.Mail();
                ApplyMailState(data);
                mailLoaded = true;
                if (announce) SetMailNote("불러왔습니다.", Theme.Muted);
            }
            catch (EditorException error)
            {
                if (!HandleExpired(error)) SetMailNote(Messages.For(error), Theme.Danger);
            }
            catch
            {
                SetMailNote("메일 설정을 불러오지 못했습니다. 네트워크를 확인해 주세요.", Theme.Danger);
            }
            finally
            {
                Cursor = Cursors.Default;
            }
        }

        private void ApplyMailState(Dictionary<string, object> data)
        {
            if (data == null) return;
            object raw;
            mailConfigured = data.TryGetValue("configured", out raw) && raw is bool && (bool)raw;
            string url = ReadString(data, "relayUrl");
            string sender = ReadString(data, "senderAddress");
            if (url.Length > 0) mailUrlBox.Text = url;
            if (sender.Length > 0) mailSenderBox.Text = sender;
            mailTokenBox.Text = "";
            mailRecipientCount = ReadInt(data, "recipients");
            mailRecipients.Text = "받는 사람 " + mailRecipientCount + "명 · 수신에 동의한 회원에게 발송됩니다.";
            SetMailSettingsNote(
                mailConfigured
                    ? "Gmail 릴레이가 연결되어 있습니다. 토큰은 저장된 값이 표시되지 않습니다."
                    : "릴레이가 설정되지 않았습니다. Gmail 앱스 스크립트 주소와 토큰을 저장해 주세요.",
                mailConfigured ? Theme.Ok : Theme.Danger);

            mailHistoryGrid.Rows.Clear();
            object historyRaw;
            object[] entries = data.TryGetValue("history", out historyRaw) ? historyRaw as object[] : null;
            if (entries == null) return;
            foreach (object entry in entries)
            {
                Dictionary<string, object> map = entry as Dictionary<string, object>;
                if (map == null) continue;
                mailHistoryGrid.Rows.Add(
                    FormatDate(ReadString(map, "createdAt")),
                    ReadString(map, "subject"),
                    ReadInt(map, "recipientCount") + "명",
                    ReadInt(map, "sentCount") + "명",
                    ReadInt(map, "failedCount") + "명");
            }
        }

        private static int ReadInt(Dictionary<string, object> map, string key)
        {
            object value;
            if (map == null || !map.TryGetValue(key, out value) || value == null) return 0;
            try
            {
                return Convert.ToInt32(value, CultureInfo.InvariantCulture);
            }
            catch
            {
                return 0;
            }
        }

        private void SaveMailSettings()
        {
            if (api.Token.Length == 0 || !loggedIn) return;
            string url = mailUrlBox.Text.Trim();
            string token = mailTokenBox.Text.Trim();
            string sender = mailSenderBox.Text.Trim();
            bool https = url.StartsWith("https://", StringComparison.OrdinalIgnoreCase) && url.Length >= 16;
            bool local = url.StartsWith("http://127.0.0.1:", StringComparison.OrdinalIgnoreCase);
            if (!https && !local)
            {
                SetMailSettingsNote("릴레이 주소는 https://로 시작하는 주소여야 합니다.", Theme.Danger);
                return;
            }
            if (token.Length > 200)
            {
                SetMailSettingsNote("토큰은 200자까지 입력할 수 있습니다.", Theme.Danger);
                return;
            }
            if (!mailConfigured && token.Length == 0)
            {
                SetMailSettingsNote("처음 설정할 때는 릴레이 토큰이 필요합니다.", Theme.Danger);
                return;
            }
            if (sender.Length > 0 && (!sender.Contains("@") || !sender.Contains(".")))
            {
                SetMailSettingsNote("발신 주소 형식을 확인해 주세요.", Theme.Danger);
                return;
            }

            mailSaveButton.Enabled = false;
            mailSendButton.Enabled = false;
            mailTestButton.Enabled = false;
            Cursor = Cursors.WaitCursor;
            SetMailSettingsNote("저장 중…", Theme.Muted);
            try
            {
                api.SaveMailSettings(url, token, sender);
                mailConfigured = true;
                mailTokenBox.Text = "";
                LoadMail(false);
                SetMailSettingsNote("릴레이 설정을 저장했습니다.", Theme.Ok);
            }
            catch (EditorException error)
            {
                if (!HandleExpired(error)) SetMailSettingsNote(Messages.For(error), Theme.Danger);
            }
            catch
            {
                SetMailSettingsNote("설정을 저장하지 못했습니다. 네트워크를 확인해 주세요.", Theme.Danger);
            }
            finally
            {
                Cursor = Cursors.Default;
                mailSaveButton.Enabled = loggedIn;
                mailSendButton.Enabled = loggedIn;
                mailTestButton.Enabled = loggedIn;
            }
        }

        private void SendMail(bool test)
        {
            if (api.Token.Length == 0 || !loggedIn) return;
            string subject = mailSubjectBox.Text.Trim();
            string body = mailBodyBox.Text.Trim();
            string testEmail = mailTestBox.Text.Trim();
            if (subject.Length == 0)
            {
                SetMailNote("제목을 입력해 주세요.", Theme.Danger);
                return;
            }
            if (body.Length == 0)
            {
                SetMailNote("내용을 입력해 주세요.", Theme.Danger);
                return;
            }
            if (test && testEmail.Length == 0)
            {
                SetMailNote("테스트 주소를 입력해 주세요.", Theme.Danger);
                return;
            }
            if (!test)
            {
                if (!mailConfigured)
                {
                    SetMailNote("메일 릴레이를 먼저 설정해 주세요.", Theme.Danger);
                    return;
                }
                string question = "수신에 동의한 회원 " + mailRecipientCount + "명에게 메일을 보냅니다.\n지금 발송할까요?";
                if (MessageBox.Show(question, "전체메일 발송", MessageBoxButtons.YesNo, MessageBoxIcon.Question)
                    != DialogResult.Yes)
                {
                    return;
                }
            }

            string sentSubject = subject;
            string sentBody = body;
            string sentTest = test ? testEmail : null;

            mailSaveButton.Enabled = false;
            mailSendButton.Enabled = false;
            mailTestButton.Enabled = false;
            Cursor = Cursors.WaitCursor;
            SetMailNote(test ? "테스트 메일을 보내는 중…" : "메일을 보내는 중…", Theme.Muted);

            Thread worker = new Thread(delegate()
            {
                string message = "";
                Color color = Theme.Ok;
                EditorException failure = null;
                try
                {
                    Dictionary<string, object> data = api.SendMail(sentSubject, sentBody, sentTest);
                    int sent = ReadInt(data, "sent");
                    int failed = ReadInt(data, "failed");
                    int recipients = ReadInt(data, "recipients");
                    if (test)
                    {
                        message = "테스트 메일을 보냈습니다. 받은 편지함을 확인해 주세요.";
                    }
                    else
                    {
                        message = "발송 완료 · 대상 " + recipients + "명 · 성공 " + sent + "명 · 실패 " + failed + "명";
                        color = failed > 0 ? Theme.Danger : Theme.Ok;
                    }
                    try
                    {
                        Dictionary<string, object> fresh = api.Mail();
                        BeginInvoke(new MethodInvoker(delegate
                        {
                            ApplyMailState(fresh);
                            mailLoaded = true;
                        }));
                    }
                    catch
                    {
                        // The send already succeeded; a stale history list is harmless.
                    }
                }
                catch (EditorException error)
                {
                    failure = error;
                }
                catch
                {
                    message = "메일을 보내지 못했습니다. 네트워크를 확인해 주세요.";
                    color = Theme.Danger;
                }

                EditorException captured = failure;
                string doneText = message;
                Color doneColor = color;
                try
                {
                    BeginInvoke(new MethodInvoker(delegate
                    {
                        Cursor = Cursors.Default;
                        mailSaveButton.Enabled = loggedIn;
                        mailSendButton.Enabled = loggedIn;
                        mailTestButton.Enabled = loggedIn;
                        if (captured != null)
                        {
                            if (!HandleExpired(captured)) SetMailNote(Messages.For(captured), Theme.Danger);
                            return;
                        }
                        SetMailNote(doneText, doneColor);
                    }));
                }
                catch
                {
                    // The window closed while the mail was being sent.
                }
            });
            worker.IsBackground = true;
            worker.Start();
        }

        private void Logout()
        {
            if (eventsBusy) return;
            api.Logout();
            ClearToken();
            cards.Clear();
            foreach (KeyValuePair<string, TextBox> pair in fields)
            {
                pair.Value.Text = "";
            }
            RebuildCards();
            mailLoaded = false;
            mailConfigured = false;
            mailRecipientCount = 0;
            mailUrlBox.Text = "";
            mailTokenBox.Text = "";
            mailSenderBox.Text = "";
            mailSubjectBox.Text = "";
            mailBodyBox.Text = "";
            mailTestBox.Text = "";
            mailSettingsNote.Text = "";
            mailNote.Text = "";
            mailRecipients.Text = "받는 사람 0명";
            if (mailHistoryGrid != null) mailHistoryGrid.Rows.Clear();
            adminNickname = "관리자";
            adminUsername = "";
            SetLoggedIn(false);
            SetFooterNote("", Theme.Muted);
            SetConnectNote("로그아웃했습니다.", Theme.Muted);
            userBox.Focus();
        }

        internal sealed class IconItem
        {
            public readonly string Name;
            public readonly string Label;

            public IconItem(string name, string label)
            {
                Name = name;
                Label = label;
            }

            public override string ToString()
            {
                return Label;
            }
        }

        internal static int RunSelfTest(string outFile, string site, string username, string password)
        {
            List<string> log = new List<string>();
            int exitCode = 0;
            EditorApi testApi = new EditorApi(site);
            try
            {
                string nickname = testApi.Login(username, password);
                log.Add("PASS login " + nickname + " token=" + testApi.Token.Length);
                Dictionary<string, object> content = testApi.Content();
                Dictionary<string, object> config = content["config"] as Dictionary<string, object>;
                log.Add("PASS content server_name=" + ReadString(config, "server_name"));
                Dictionary<string, string> values = new Dictionary<string, string>();
                foreach (string key in FieldKeys) values[key] = ReadString(config, key);
                values["world_cards"] = ReadString(config, "world_cards");
                testApi.Save(values);
                log.Add("PASS save");
                Dictionary<string, object> again = testApi.Content();
                Dictionary<string, object> after = again["config"] as Dictionary<string, object>;
                bool same = ReadString(after, "tagline") == ReadString(config, "tagline");
                log.Add((same ? "PASS" : "FAIL") + " reread tagline=" + ReadString(after, "tagline"));
                if (!same) exitCode = 1;

                List<Member> list = testApi.Members();
                log.Add("PASS members count=" + list.Count);
                int pendingCount = 0;
                foreach (Member member in list)
                {
                    if (!member.Verified) pendingCount += 1;
                }
                log.Add("PASS approvals pending=" + pendingCount);
                Member target = null;
                foreach (Member member in list)
                {
                    if (!member.IsAdmin() && member.Username != username)
                    {
                        target = member;
                        break;
                    }
                }
                if (target == null)
                {
                    log.Add("SKIP sanction (no member account)");
                }
                else
                {
                    Dictionary<string, object> restrict = new Dictionary<string, object>();
                    restrict["status"] = "restricted";
                    restrict["days"] = 1;
                    restrict["reason"] = "selftest";
                    Member restricted = testApi.UpdateMember(target.Id, restrict);
                    log.Add((restricted.Status == "restricted" ? "PASS" : "FAIL")
                        + " restrict " + target.Username + " until=" + restricted.SanctionUntil);
                    if (restricted.Status != "restricted") exitCode = 1;

                    Dictionary<string, object> clear = new Dictionary<string, object>();
                    clear["status"] = "active";
                    Member cleared = testApi.UpdateMember(target.Id, clear);
                    log.Add((cleared.Status == "active" ? "PASS" : "FAIL") + " clear sanction");
                    if (cleared.Status != "active") exitCode = 1;
                }

                Dictionary<string, object> mailState = testApi.Mail();
                object configuredRaw;
                bool configuredOk = mailState.TryGetValue("configured", out configuredRaw)
                    && configuredRaw is bool && (bool)configuredRaw;
                object[] mailHistory;
                object historyRaw2;
                mailHistory = mailState.TryGetValue("history", out historyRaw2) ? historyRaw2 as object[] : null;
                log.Add("PASS mail configured=" + (configuredOk ? "yes" : "no")
                    + " recipients=" + ReadInt(mailState, "recipients")
                    + " history=" + (mailHistory == null ? 0 : mailHistory.Length));

                testApi.Logout();
                log.Add("PASS logout");
            }
            catch (EditorException error)
            {
                log.Add("FAIL " + error.Code);
                exitCode = 1;
            }
            catch (Exception error)
            {
                log.Add("FAIL unexpected " + error.GetType().Name + " " + error.Message);
                exitCode = 1;
            }

            try { File.WriteAllLines(outFile, log.ToArray(), Encoding.UTF8); }
            catch { exitCode = 1; }
            return exitCode;
        }

        internal static void SetDpiAware()
        {
            try { SetProcessDPIAware(); } catch { }
        }
    }

    internal static class Program
    {
        [STAThread]
        private static void Main(string[] args)
        {
            if (args.Length >= 5 && args[0] == "--selftest")
            {
                Environment.ExitCode = MainForm.RunSelfTest(args[1], args[2], args[3], args[4]);
                return;
            }

            MainForm.SetDpiAware();
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }
    }
}
