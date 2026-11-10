package kr.dimension.status;

import org.bukkit.Bukkit;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

public final class StatusPlugin extends JavaPlugin {
    // HttpURLConnection silently drops the Origin header (it is on the JDK's
    // restricted list), and the site gateway rejects Origin-less POSTs with
    // 403. HttpClient sends it, so the bridge works without browser help.
    private static final HttpClient CLIENT = HttpClient.newBuilder()
        .version(HttpClient.Version.HTTP_1_1)
        .connectTimeout(Duration.ofSeconds(4))
        .build();

    private BukkitTask task;
    private String site = "";
    private String key = "";
    private String origin = "";
    private String fixedHost = "";
    private int bedrockPort = 19132;

    private String cachedHost = "";
    private long cachedHostAt = 0L;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        FileConfiguration config = getConfig();
        site = trimSlash(config.getString("site", ""));
        key = config.getString("bridge-key", "");
        origin = config.getString("origin", site);
        fixedHost = config.getString("public-host", "").trim();
        bedrockPort = config.getInt("bedrock-port", 19132);
        if (site.isEmpty() || key.isEmpty() || "CHANGE_ME".equals(key)) {
            getLogger().warning("site 또는 bridge-key가 비어 있어 실시간 상태 전송을 시작하지 않습니다.");
            return;
        }
        int seconds = Math.max(15, config.getInt("interval-seconds", 45));
        task = Bukkit.getScheduler().runTaskTimerAsynchronously(
            this, this::sendHeartbeat, 20L, seconds * 20L);
        getLogger().info("DIMENSION 사이트로 상태와 접속 주소를 전송합니다 (" + seconds + "초 간격).");
    }

    @Override
    public void onDisable() {
        if (task != null) task.cancel();
        if (site.isEmpty() || key.isEmpty()) return;
        Thread offline = new Thread(() -> post(false, 0, 0), "DIMENSION-status-offline");
        offline.setDaemon(true);
        offline.start();
        try {
            offline.join(1500L);
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        }
    }

    private void sendHeartbeat() {
        post(true, Bukkit.getOnlinePlayers().size(), Bukkit.getMaxPlayers());
    }

    private void post(boolean online, int players, int maxPlayers) {
        try {
            String host = resolveHost();
            int javaPort = Bukkit.getPort();
            byte[] body = ("{\"online\":" + online
                + ",\"players\":" + players
                + ",\"maxPlayers\":" + maxPlayers
                + ",\"host\":\"" + escape(host) + "\""
                + ",\"javaPort\":" + javaPort
                + ",\"bedrockPort\":" + bedrockPort + "}").getBytes(StandardCharsets.UTF_8);
            HttpRequest.Builder request = HttpRequest.newBuilder(
                    URI.create(site + "/functions/v1/app/api/internal/status"))
                .timeout(Duration.ofSeconds(6))
                .header("Content-Type", "application/json; charset=utf-8")
                .header("Accept", "application/json")
                .header("User-Agent", "DimensionStatus/1.2")
                .header("x-bridge-key", key)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body));
            if (!origin.isEmpty()) request.header("Origin", origin);

            HttpResponse<String> response = CLIENT.send(
                request.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            int status = response.statusCode();
            if (status < 200 || status >= 300) {
                String hint = response.body();
                if (hint.length() > 200) hint = hint.substring(0, 200);
                getLogger().warning("상태 전송 실패: HTTP " + status + (hint.isEmpty() ? "" : " " + hint));
                if (status == 403 && hint.contains("bridge_forbidden")) {
                    getLogger().warning("bridge-key가 사이트에 등록된 키와 다릅니다. "
                        + "plugins/DIMENSIONStatus/config.yml 값을 확인해 주세요.");
                }
            }
        } catch (Exception error) {
            getLogger().warning("상태 전송 실패: " + error.getMessage());
        }
    }

    // The address members see. A fixed host wins; otherwise the public address is
    // discovered once and cached, so dynamic IPs are picked up within the cache window.
    private String resolveHost() {
        if (!fixedHost.isEmpty()) return fixedHost;
        if (!cachedHost.isEmpty() && System.currentTimeMillis() - cachedHostAt < 10 * 60 * 1000L) {
            return cachedHost;
        }
        String detected = detectPublicHost();
        if (!detected.isEmpty()) {
            cachedHost = detected;
            cachedHostAt = System.currentTimeMillis();
        }
        return cachedHost;
    }

    private String detectPublicHost() {
        String[] endpoints = {
            "https://api.ipify.org",
            "https://ifconfig.me/ip",
            "https://checkip.amazonaws.com",
        };
        for (String endpoint : endpoints) {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) URI.create(endpoint).toURL().openConnection();
                connection.setConnectTimeout(3000);
                connection.setReadTimeout(3000);
                connection.setRequestProperty("User-Agent", "DimensionStatus/1.2");
                if (connection.getResponseCode() != 200) continue;
                StringBuilder text = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) text.append(line);
                }
                String value = text.toString().trim().toLowerCase();
                if (value.matches("[a-z0-9.:-]{3,253}")) return value;
            } catch (Exception ignored) {
                // Try the next endpoint.
            } finally {
                if (connection != null) connection.disconnect();
            }
        }
        return "";
    }

    private static String escape(String value) {
        return value.replace("\\", "").replace("\"", "");
    }

    private static String trimSlash(String value) {
        if (value == null) return "";
        String trimmed = value.trim();
        while (trimmed.endsWith("/")) trimmed = trimmed.substring(0, trimmed.length() - 1);
        return trimmed;
    }
}
