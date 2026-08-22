/**
 * Giá trị mặc định khi tạo node mới trong editor.
 *
 * Quy tắc: MỌI prop trong schema phải có default ở đây. Node lưu xuống DB
 * là object đầy đủ — không có prop optional, không phải merge lúc render.
 * Đổi lại file nặng hơn ~30%, nhưng renderer không cần biết version nào
 * thiếu prop gì, và migration chỉ chạy một lần lúc load (xem migrate.ts).
 */

import type {
  BaseProps, Quad, Transition, ContinuousAnimation, BoxShadow,
  NodeType, PropsOf, TemplateNode, TemplateDoc, EffectsConfig,
} from './types';
import { SCHEMA_VERSION } from './types';

const ZERO_QUAD: Quad = [0, 0, 0, 0];

export const DEFAULT_SHADOW: BoxShadow = {
  offsetX: 0, offsetY: 2, blur: 10, spread: 0, color: 'rgba(0, 0, 0, 0.25)',
};

export const DEFAULT_TRANSITION: Transition = {
  effectType: 'slide-up',
  effectDuration: 1.2,
  effectDelay: 0.2,
  effectEasing: 'ease-out',
  effectEnabled: true,
};

export const NO_ANIMATION: ContinuousAnimation = { type: 'none', duration: 2, delay: 0 };

export function baseProps(rect: Partial<BaseProps> = {}): BaseProps {
  return {
    top: 0, left: 0, width: 200, height: 60,
    backgroundColor: 'transparent',
    padding: [...ZERO_QUAD] as Quad,
    opacity: 1,
    rotation: 0,
    borderRadius: [...ZERO_QUAD] as Quad,
    borderPosition: 'all',
    borderSize: 0,
    borderStyle: 'solid',
    borderColor: '',
    hasShadow: false,
    boxShadow: { ...DEFAULT_SHADOW },
    zIndex: 0,
    locked: false,
    hidden: false,
    transition: { ...DEFAULT_TRANSITION },
    continuousAnimation: { ...NO_ANIMATION },
    hyperlink: '',
    ...rect,
  };
}

type DefaultsMap = { [T in NodeType]: () => PropsOf<T> };

export const NODE_DEFAULTS: DefaultsMap = {
  Text: () => ({
    ...baseProps({ width: 240, height: 32 }),
    text: 'Nhập nội dung',
    fontFamily: 'Quicksand',
    fontSize: 20,
    fontWeight: '500',
    fontStyle: 'normal',
    color: '#333333',
    textAlign: 'center',
    lineHeight: 'normal',
    letterSpacing: '0',
    textTransform: 'none',
    textDecoration: 'none',
    textStroke: null,
  }),

  Photo: () => ({
    ...baseProps({ width: 300, height: 200 }),
    imgKey: '',
    maskShapeImg: null,
    flipX: false,
    flipY: false,
    objectFit: 'cover',
    isReplaceable: true,
    slot: null,
  }),

  Shape: () => ({
    ...baseProps({ width: 120, height: 120 }),
    shapeKind: 'svg',
    imgKey: '',
    color: '#8a0d0d',
    flipX: false,
    flipY: false,
  }),

  Envelope: () => ({
    ...baseProps({ width: 430, height: 287 }),
    imgKey: '',
    slot: null,
    sealImg: '',
    envelopeColor: '#812927',
    flapColor: '#812927',
    pocketSideColor: '#a33f3d',
    pocketBottomColor: '#a84644',
    heartColor: '#d00000',
    lockScrollUntilOpened: true,
    dismissAfter: 3.4,
  }),

  Calendar: () => ({
    ...baseProps({ width: 460, height: 320 }),
    month: new Date().toISOString(),
    markedDates: [],
    markerIcon: null,
    themeColor: '#e8a0aa',
    color: '#000000',
    fontFamily: 'Roboto',
    fontSize: 14,
    weekStartsOn: 1,
    showLunar: false,
  }),

  CountDown: () => ({
    ...baseProps({ width: 380, height: 94 }),
    targetDate: new Date().toISOString(),
    themeColor: '#8a0d0d',
    color: '#ffffff',
    fontFamily: 'Quicksand',
    fontSize: 14,
    direction: 'horizontal',
    spacing: 20,
    labels: { days: 'ngày', hours: 'giờ', minutes: 'phút', seconds: 'giây' },
    expiredText: 'Hôm nay là ngày cưới!',
  }),

  RsvpForm: () => ({
    ...baseProps({ width: 350, height: 380, backgroundColor: '#ffffff', padding: [16, 16, 16, 16], borderRadius: [8, 8, 8, 8], borderSize: 1, borderColor: '#e0e0e0', hasShadow: true }),
    titleText: 'Xác nhận tham dự',
    nameLabel: 'Họ và tên',
    attendLabel: 'Bạn sẽ tham dự chứ?',
    attendYesText: 'Có, tôi sẽ tham dự',
    attendNoText: 'Rất tiếc, tôi bận mất rồi',
    enableAttendeeCount: true,
    attendeeCountLabel: 'Số lượng người tham dự',
    enableGuestSide: true,
    guestSideLabel: 'Bạn là khách của ai?',
    guestSideGroomText: 'Nhà trai',
    guestSideBrideText: 'Nhà gái',
    enableTransportation: false,
    transportationLabel: 'Bạn đi phương tiện gì?',
    transportationSelfText: 'Tự đi',
    transportationPickupText: 'Cần xe đưa đón',
    pickupDateTimeLabel: 'Khung giờ đón',
    pickupTimeSlots: [],
    enableMessage: true,
    messageLabel: 'Lời chúc',
    submitText: 'Gửi xác nhận',
    successText: 'Cảm ơn bạn! Hẹn gặp trong ngày vui.',
    color: '#333333',
    buttonColor: '#8a0d0d',
    buttonTextColor: '#ffffff',
    fontFamily: 'Quicksand',
    fontSize: 14,
  }),

  Gallery: () => ({
    ...baseProps({ width: 460, height: 440, padding: [10, 10, 10, 10], borderRadius: [8, 8, 8, 8] }),
    photos: [],
    layout: 'carousel',
    showThumbnails: true,
    showNavButtons: true,
    showFullscreenButton: true,
    autoplay: false,
    autoplayInterval: 4000,
  }),

  GiftQr: () => ({
    ...baseProps({ width: 100, height: 100, continuousAnimation: { type: 'wobble', duration: 2, delay: 0 } }),
    imgKey: '',
    modalTitle: 'Hộp quà yêu thương',
    accounts: [],
    flipX: false,
    flipY: false,
  }),

  Map: () => ({
    ...baseProps({ width: 160, height: 36, borderRadius: [18, 18, 18, 18] }),
    label: 'Xem chỉ đường',
    lat: null,
    lng: null,
    query: '',
    mode: 'button',
    color: '#ffffff',
    buttonColor: '#8a0d0d',
    fontFamily: 'Quicksand',
    fontSize: 14,
  }),

  Wishes: () => ({
    ...baseProps({ width: 400, height: 300 }),
    titleText: 'Sổ lưu bút',
    emptyText: 'Hãy là người đầu tiên gửi lời chúc',
    maxVisible: 5,
    color: '#333333',
    fontFamily: 'Quicksand',
    fontSize: 14,
  }),

  Video: () => ({
    ...baseProps({ width: 460, height: 260 }),
    source: { kind: 'youtube', id: '' },
    autoplay: false,
    loop: true,
    muted: true,
    poster: null,
  }),
};

const NODE_LABEL: Record<NodeType, string> = {
  Text: 'Văn bản', Photo: 'Ảnh', Shape: 'Hoạ tiết', Envelope: 'Bì thư',
  Calendar: 'Lịch', CountDown: 'Đếm ngược', RsvpForm: 'Form xác nhận',
  Gallery: 'Album', GiftQr: 'Mừng cưới', Map: 'Chỉ đường',
  Wishes: 'Lưu bút', Video: 'Video',
};

export function createNode<T extends NodeType>(
  type: T,
  sectionId: string,
  overrides: Partial<PropsOf<T>> = {},
  id: string = crypto.randomUUID(),
): Extract<TemplateNode, { type: T }> {
  const node = {
    id,
    type,
    name: NODE_LABEL[type],
    sectionId,
    props: { ...NODE_DEFAULTS[type](), ...overrides },
  };
  // Spread của generic không thu hẹp được về nhánh union tương ứng
  return node as unknown as Extract<TemplateNode, { type: T }>;
}

export const DEFAULT_EFFECTS: EffectsConfig = {
  falling: { enabled: false, kind: 'heart', imgKey: null, density: 20, speed: 1 },
};

/** Canvas rỗng: 1 section, bề rộng thiết kế 500px (khớp tỉ lệ điện thoại) */
export function createEmptyDoc(id: string, name: string, slug: string): TemplateDoc {
  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    name,
    slug,
    canvas: { baseWidth: 500, height: 800, background: '#ffffff' },
    sections: [{ id: 'sec-1', name: 'Bìa', top: 0, height: 800, background: null }],
    order: [],
    nodes: {},
    fonts: [],
    audio: null,
    effects: structuredClone(DEFAULT_EFFECTS),
  };
}
