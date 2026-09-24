import { GAME_HTML } from './game-html';

export const dynamic = 'force-static';

/**
 * Trò chơi đoán bài hát cưới: /trochoiamnhac
 *
 * Trả thẳng một trang HTML độc lập thay vì dựng bằng React — trang này tự có
 * font, CSS và script riêng, không dùng chung gì với layout của web.
 */
export function GET() {
  return new Response(GAME_HTML, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
