import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";
import { isIosInstallable } from "@/lib/platform";

const DISMISS_KEY = "dimension-ios-install-dismissed-v1";

export function IosInstallHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isIosInstallable()) return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // Storage can be unavailable in private mode; the hint still shows.
    }
    setVisible(true);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Ignore.
    }
  };

  return (
    <aside className="ios-install" aria-label="iPhone 설치 안내">
      <div className="ios-install-head">
        <p className="ios-install-title">
          <Share size={16} aria-hidden="true" />
          iPhone 홈 화면에 추가
        </p>
        <button type="button" className="icon-button" onClick={dismiss} aria-label="안내 닫기">
          <X size={16} />
        </button>
      </div>
      <p className="ios-install-body">
        Safari 하단의 <strong>공유</strong> 버튼을 누르고 <strong>홈 화면에 추가</strong>를 선택하면
        홈 화면에 아이콘이 생기고, 앱처럼 전체화면으로 열립니다.
      </p>
    </aside>
  );
}
