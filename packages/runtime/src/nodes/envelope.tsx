/**
 * Bì thư mở được — màn chào của thiệp.
 *
 * Ba lý do nó không phải là ảnh:
 *   - nắp, hai cánh bên và đáy bì là ba tam giác `border`, đổi màu là đổi cả bộ;
 *   - bì co giãn theo `width`/`height` mà không có pixel nào bị kéo méo;
 *   - lá thư trồi lên phải nằm *dưới* nắp rồi vượt *lên trên* nó, thứ chỉ làm
 *     được khi từng mảnh là một phần tử riêng có z-index của mình.
 *
 * Kích thước bên trong đều tính theo `--eh`/`--ew` bằng calc(), nên một bảng
 * CSS duy nhất phục vụ mọi bì thư trong trang, không sinh style theo node.
 */

import { useEffect, useRef, useState } from 'react';
import { NodeShell } from '../NodeShell';
import type { NodeProps } from '../NodeShell';
import { useRuntime } from '../context';
import { imageUrl } from '../image';

type Phase = 'closed' | 'open' | 'gone';

export function EnvelopeNode({ node }: NodeProps<'Envelope'>) {
  const { assetBase, dpr, data, mode, scale } = useRuntime();
  const p = node.props;

  const [phase, setPhase] = useState<Phase>('closed');
  const hostRef = useRef<HTMLDivElement>(null);
  const unlockRef = useRef<(() => void) | null>(null);

  const live = mode === 'render';

  /**
   * Khoá cuộn ngay khi bì xuất hiện. Không khoá thì khách lướt thẳng qua màn
   * chào — bì thư chưa kịp được chạm vào lần nào.
   */
  useEffect(() => {
    if (!live || !p.lockScrollUntilOpened || phase !== 'closed') return;
    unlockRef.current = lockScroll(hostRef.current);
    return () => {
      unlockRef.current?.();
      unlockRef.current = null;
    };
  }, [live, p.lockScrollUntilOpened, phase]);

  // Mở xong thì bì mờ đi nhường chỗ cho bìa thiệp bên dưới.
  useEffect(() => {
    if (phase !== 'open' || p.dismissAfter <= 0) return;
    const id = setTimeout(() => setPhase('gone'), p.dismissAfter * 1000);
    return () => clearTimeout(id);
  }, [phase, p.dismissAfter]);

  if (phase === 'gone') return null;

  const key = (p.slot && data?.photos?.[p.slot]) || p.imgKey;
  const letter = key ? imageUrl(assetBase, key, p.width * scale, dpr) : '';
  const seal = p.sealImg ? imageUrl(assetBase, p.sealImg, 120, dpr, { format: 'png' }) : '';

  const open = phase === 'open';

  return (
    <NodeShell id={node.id} p={p}>
      <style dangerouslySetInnerHTML={{ __html: ENVELOPE_CSS }} />
      <div
        ref={hostRef}
        className="tc-env"
        style={{
          ['--ew' as string]: `${p.width}px`,
          ['--eh' as string]: `${p.height}px`,
          ['--env-body' as string]: p.envelopeColor,
          ['--env-flap' as string]: p.flapColor,
          ['--env-side' as string]: p.pocketSideColor,
          ['--env-bottom' as string]: p.pocketBottomColor,
          ['--env-heart' as string]: p.heartColor,
          opacity: open && p.dismissAfter > 0 ? 0 : 1,
          // Mờ dần đúng lúc bì sắp bị gỡ, không phải ngay khi vừa bấm mở
          transition: `opacity 0.7s ease ${Math.max(p.dismissAfter - 0.7, 0)}s`,
        }}
      >
        <div className="tc-env-shadow" aria-hidden />
        <div
          className={`tc-env-box ${open ? 'is-open' : 'is-closed'}`}
          role={live && !open ? 'button' : undefined}
          tabIndex={live && !open ? 0 : undefined}
          aria-label={live && !open ? 'Chạm để mở thiệp' : undefined}
          onClick={() => live && setPhase('open')}
          onKeyDown={(e) => {
            if (!live || open) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setPhase('open');
            }
          }}
        >
          <div className="tc-env-front tc-env-flap" aria-hidden />
          <div className="tc-env-front tc-env-pocket" aria-hidden />
          {seal && <div className="tc-env-seal" style={{ backgroundImage: `url("${seal}")` }} aria-hidden />}

          <div className="tc-env-letter">
            {/* Ảnh chỉ tải khi bì đã mở: lúc đóng nó nằm khuất sau nắp */}
            {open && letter ? (
              <img src={letter} alt="" decoding="async" />
            ) : (
              <>
                <span className="tc-env-line l1" />
                <span className="tc-env-line l2" />
                <span className="tc-env-line l3" />
                <span className="tc-env-line l4" />
              </>
            )}
          </div>

          <div className="tc-env-hearts" aria-hidden>
            <span className="tc-env-heart h1" />
            <span className="tc-env-heart h2" />
            <span className="tc-env-heart h3" />
          </div>
        </div>
      </div>
    </NodeShell>
  );
}

/**
 * Khoá mọi khung cuộn bao quanh bì thư, rồi trả về hàm mở khoá.
 *
 * Phải đi ngược cây thay vì khoá mỗi `body`: trên màn hình rộng trang thiệp
 * cuộn trong một khung riêng, còn trên điện thoại thì cuộn cả trang — khoá một
 * chỗ thì chỗ kia vẫn trôi. `touchAction` là phần bắt buộc cho iOS, ở đó
 * `overflow: hidden` một mình không chặn được cử chỉ vuốt.
 */
function lockScroll(el: HTMLElement | null): () => void {
  if (typeof document === 'undefined') return () => {};

  const saved: Array<[HTMLElement, string, string]> = [];
  const lock = (n: HTMLElement) => {
    saved.push([n, n.style.overflowY, n.style.touchAction]);
    n.style.overflowY = 'hidden';
    n.style.touchAction = 'none';
  };

  for (let n = el?.parentElement ?? null; n; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if (oy === 'auto' || oy === 'scroll') lock(n);
  }
  lock(document.body);
  lock(document.documentElement);

  return () => {
    for (const [n, overflowY, touchAction] of saved) {
      n.style.overflowY = overflowY;
      n.style.touchAction = touchAction;
    }
  };
}

const EASE = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)';

const ENVELOPE_CSS = `
.tc-env { position: absolute; inset: 0; }
.tc-env-shadow { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
.tc-env-shadow::after {
  content: ''; position: absolute;
  width: calc(var(--ew) * 1.14); height: 25px; border-radius: 50%;
  background: rgba(0, 0, 0, 0.2); filter: blur(4px);
  top: calc(var(--eh) + 50px); left: 50%; transform: translateX(-50%);
  animation: tc-env-shadow 3s ease-in-out infinite;
}
.tc-env-box {
  position: absolute; inset: 0;
  border-bottom-left-radius: 6px; border-bottom-right-radius: 6px;
  background-color: var(--env-body);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  animation: tc-env-float 3s ease-in-out infinite;
  z-index: 1;
}
.tc-env-box.is-closed { cursor: pointer; }
.tc-env-front { position: absolute; width: 0; height: 0; z-index: 3; }
.tc-env-flap {
  border-left: calc(var(--ew) / 2) solid transparent;
  border-right: calc(var(--ew) / 2) solid transparent;
  border-bottom: calc(var(--eh) * 0.46) solid transparent;
  border-top: calc(var(--eh) * 0.54) solid var(--env-flap);
  transform-origin: top;
}
.tc-env-box.is-open .tc-env-flap {
  transform: rotateX(180deg); z-index: 1;
  transition: transform 1.2s ${EASE}, z-index 1.2s;
}
.tc-env-box.is-closed .tc-env-flap {
  transform: rotateX(0deg); z-index: 5;
  transition: transform 0.8s 0.8s ${EASE}, z-index 0.8s;
}
.tc-env-pocket {
  border-left: calc(var(--ew) / 2) solid var(--env-side);
  border-right: calc(var(--ew) / 2) solid var(--env-side);
  border-bottom: calc(var(--eh) / 2) solid var(--env-bottom);
  border-top: calc(var(--eh) / 2) solid transparent;
  border-bottom-left-radius: 6px; border-bottom-right-radius: 6px;
}
.tc-env-seal {
  position: absolute; top: calc(var(--eh) * 0.4); left: 50%;
  transform: translateX(-50%);
  width: calc(var(--eh) * 0.195); height: calc(var(--eh) * 0.195);
  background-size: contain; background-repeat: no-repeat; background-position: center;
  z-index: 10;
}
.tc-env-letter {
  position: relative; width: 90%; height: 90%; top: 5%;
  margin-left: auto; margin-right: auto;
  background-color: #fff; border-radius: 6px; overflow: hidden;
  box-shadow: 0 2px 26px rgba(0, 0, 0, 0.12);
}
.tc-env-letter::after {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background-image: linear-gradient(180deg, rgba(255,255,255,0) 25%, rgba(255,227,239,0.2) 75%, rgba(215,227,239,0.3) 100%);
}
.tc-env-letter img { width: 100%; height: 100%; object-fit: cover; border-radius: 6px; display: block; }
.tc-env-box.is-open .tc-env-letter {
  transform: translateY(calc(var(--eh) * -0.475)); z-index: 2;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.2);
  transition: transform 1s 0.5s ${EASE}, z-index 0.5s;
}
.tc-env-box.is-closed .tc-env-letter {
  transform: translateY(0); z-index: 1;
  transition: transform 0.6s 0.2s ${EASE}, z-index 0.2s;
}
.tc-env-line { position: absolute; left: 10%; width: 80%; height: 14%; background-color: #eeeff0; }
.tc-env-line.l1 { top: 15%; width: 20%; height: 7%; }
.tc-env-line.l2 { top: 30%; }
.tc-env-line.l3 { top: 50%; }
.tc-env-line.l4 { top: 70%; }
.tc-env-hearts { position: absolute; top: calc(var(--eh) * 0.55); left: 0; right: 0; z-index: 2; pointer-events: none; }
.tc-env-heart { position: absolute; bottom: 0; right: 10%; }
.tc-env-heart::before, .tc-env-heart::after {
  content: ''; position: absolute; top: 0; left: calc(var(--eh) * 0.1605);
  width: calc(var(--eh) * 0.1605); height: calc(var(--eh) * 0.2565);
  background-color: var(--env-heart);
  border-radius: calc(var(--eh) * 0.1605) calc(var(--eh) * 0.1605) 0 0;
  transform: rotate(-45deg); transform-origin: 0 100%;
}
.tc-env-heart::after { left: 0; transform: rotate(45deg); transform-origin: 100% 100%; }
.tc-env-heart.h1 { left: 20%; --heart-scale: 0.6; transform: scale(0.6); }
.tc-env-heart.h2 { left: 55%; --heart-scale: 1; transform: scale(1); }
.tc-env-heart.h3 { left: 10%; --heart-scale: 0.8; transform: scale(0.8); }
.tc-env-box.is-closed .tc-env-heart { opacity: 0; animation: none; transform: scale(0); }
.tc-env-box.is-open .tc-env-heart {
  animation-name: tc-env-heart-rise, tc-env-heart-sway, tc-env-heart-pop;
  animation-timing-function: ${EASE}, ease-in-out, cubic-bezier(0.68, -0.55, 0.265, 1.55);
  animation-fill-mode: forwards;
  animation-direction: normal, alternate, normal;
}
.tc-env-box.is-open .tc-env-heart.h1 {
  animation-duration: 4s, 2s, 0.5s; animation-iteration-count: 1, 4, 1; animation-delay: 1.2s;
}
.tc-env-box.is-open .tc-env-heart.h2 {
  animation-duration: 5s, 4s, 0.5s; animation-iteration-count: 1, 2, 1; animation-delay: 1.4s;
}
.tc-env-box.is-open .tc-env-heart.h3 {
  animation-duration: 7s, 2s, 0.5s; animation-iteration-count: 1, 6, 1; animation-delay: 1.6s;
}
@keyframes tc-env-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-20px); }
}
@keyframes tc-env-shadow {
  0%, 100% { transform: translateX(-50%) scaleX(1); }
  50% { transform: translateX(-50%) scaleX(0.85); }
}
@keyframes tc-env-heart-rise {
  0% { top: 0; opacity: 1; }
  50% { opacity: 0.8; }
  80% { opacity: 0.3; }
  100% { top: -600px; opacity: 0; visibility: hidden; }
}
@keyframes tc-env-heart-sway {
  0% { margin-left: 0; }
  50% { margin-left: 25px; }
  100% { margin-left: 50px; }
}
@keyframes tc-env-heart-pop {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.2); opacity: 0.8; }
  100% { transform: scale(var(--heart-scale, 1)); opacity: 1; }
}
`;
