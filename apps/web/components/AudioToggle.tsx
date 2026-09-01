'use client';

/**
 * Nút bật/tắt nhạc nền.
 *
 * Trình duyệt chặn autoplay có tiếng cho tới khi người dùng chạm vào trang, nên
 * lần play đầu tiên luôn phải giả định có thể thất bại và giữ nút ở trạng thái
 * tắt thay vì báo lỗi.
 */

import { useEffect, useRef, useState } from 'react';
import { assetUrl } from '@thiepcuoi/schema';
import type { AudioConfig } from '@thiepcuoi/schema';

/**
 * `startSignal` tăng lên mỗi lần app muốn nhạc bắt đầu — hiện là lúc khách chạm
 * mở bì thư. Dùng một con số thay vì boolean để lần chạm sau vẫn kích hoạt được
 * dù lần trước đã thử và trượt.
 */
export function AudioToggle({
  audio,
  assetBase,
  startSignal = 0,
}: {
  audio: AudioConfig;
  assetBase: string;
  startSignal?: number;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!audio.autoplay) return;
    ref.current?.play().then(
      () => setPlaying(true),
      () => setPlaying(false),
    );
  }, [audio.autoplay]);

  /**
   * Bì thư vừa mở. Vẫn phải phòng trường hợp trượt: người dùng có thể đã tự tắt
   * tiếng ở cấp hệ điều hành, và ta không muốn nút hiện "đang phát" khi im lặng.
   */
  useEffect(() => {
    if (startSignal <= 0) return;
    ref.current?.play().then(
      () => setPlaying(true),
      () => setPlaying(false),
    );
  }, [startSignal]);

  function toggle() {
    const el = ref.current;
    if (!el) return;
    if (el.paused) el.play().then(() => setPlaying(true), () => setPlaying(false));
    else {
      el.pause();
      setPlaying(false);
    }
  }

  return (
    <>
      <audio ref={ref} src={assetUrl(assetBase, audio.key)} loop={audio.loop} preload="none" />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? `Tắt nhạc: ${audio.title}` : `Bật nhạc: ${audio.title}`}
        style={{
          position: 'fixed',
          top: 12,
          right: 12,
          zIndex: 10000,
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: 'none',
          background: audio.iconColor || '#7a2c2c',
          color: '#fff',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          animation: playing ? 'tc-spin 6s linear infinite' : undefined,
        }}
      >
        {playing ? '♪' : '♪̸'}
      </button>
    </>
  );
}
