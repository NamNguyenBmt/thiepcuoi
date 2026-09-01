'use client';

/**
 * Nút bật/tắt nhạc nền.
 *
 * Trình duyệt chặn autoplay có tiếng cho tới khi người dùng chạm vào trang, nên
 * lần play đầu tiên luôn phải giả định có thể thất bại và giữ nút ở trạng thái
 * tắt thay vì báo lỗi.
 */

import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { assetUrl } from '@thiepcuoi/schema';
import type { AudioConfig } from '@thiepcuoi/schema';

/**
 * `playRef` nhận về một hàm bật nhạc để chỗ khác gọi **ngay trong cú chạm** của
 * khách — cụ thể là lúc mở bì thư.
 *
 * Vì sao không dùng prop/state để ra hiệu: state đi qua một vòng render rồi mới
 * tới `useEffect`, tức là `play()` chạy sau khi handler đã kết thúc. Cửa sổ
 * "transient activation" thường vẫn còn nên phần lớn máy vẫn kêu, nhưng iOS là
 * nơi khắt khe nhất mà cũng là nơi đông khách xem thiệp nhất — gọi thẳng trong
 * handler thì không phải đánh cược.
 */
export function AudioToggle({
  audio,
  assetBase,
  playRef,
}: {
  audio: AudioConfig;
  assetBase: string;
  playRef?: MutableRefObject<(() => void) | null>;
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
   * Bám theo trạng thái thật của thẻ audio, đừng chỉ tin lần bấm gần nhất: iOS
   * tự dừng nhạc khi app khác phát tiếng, và khách dừng được từ màn hình khoá.
   * Không nghe hai sự kiện này thì nút hiện "đang phát" trong lúc im lặng.
   */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const dangPhat = () => setPlaying(true);
    const dungLai = () => setPlaying(false);
    el.addEventListener('play', dangPhat);
    el.addEventListener('pause', dungLai);
    return () => {
      el.removeEventListener('play', dangPhat);
      el.removeEventListener('pause', dungLai);
    };
  }, []);

  /**
   * Vẫn phải phòng trường hợp trượt: khách có thể đang để máy ở chế độ im lặng.
   * Lúc đó nút phải hiện "đang tắt" chứ không được nói dối là đang phát.
   */
  useEffect(() => {
    if (!playRef) return;
    playRef.current = () => {
      ref.current?.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
    };
    return () => {
      playRef.current = null;
    };
  }, [playRef]);

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
