/**
 * ThiepCuoiOnline — Template schema
 *
 * Mô hình: 1 canvas toạ độ tuyệt đối (design width cố định), các node phẳng
 * nhóm theo "section" để render theo lô và chạy animation khi scroll tới.
 */

export const SCHEMA_VERSION = 1;

// ─────────────────────────── Primitives ───────────────────────────

export type Px = number;
/** [top, right, bottom, left] — dùng cho padding và borderRadius */
export type Quad = [number, number, number, number];

export interface Rect {
  top: Px;
  left: Px;
  width: Px;
  height: Px;
}

export interface BoxShadow {
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: string;
}

export type BorderPosition = 'all' | 'top' | 'right' | 'bottom' | 'left';
export type BorderStyle = 'solid' | 'dashed' | 'dotted' | 'double';

/** Animation một lần, kích hoạt khi node lọt vào viewport */
export type EntranceEffect =
  | 'none' | 'fade'
  | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right'
  | 'zoom-in' | 'zoom-out' | 'flip' | 'blur-in';

export interface Transition {
  effectType: EntranceEffect;
  effectDuration: number; // giây
  effectDelay: number;    // giây
  effectEasing: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
  effectEnabled: boolean;
}

/** Animation lặp vô hạn */
export type ContinuousType =
  | 'none' | 'wobble' | 'pulse' | 'float' | 'shake' | 'spin' | 'heartbeat';

export interface ContinuousAnimation {
  type: ContinuousType;
  duration: number;
  delay: number;
}

// ─────────────────────────── Base props ───────────────────────────

/** Props mọi node đều có. Node cụ thể chỉ mở rộng thêm. */
export interface BaseProps extends Rect {
  backgroundColor: string;
  padding: Quad;
  opacity: number;   // 0..1
  rotation: number;  // độ
  borderRadius: Quad;
  borderPosition: BorderPosition;
  borderSize: number;
  borderStyle: BorderStyle;
  borderColor: string;
  hasShadow: boolean;
  boxShadow: BoxShadow;
  zIndex: number;
  locked: boolean;   // khoá trong editor: không chọn/kéo được
  hidden: boolean;
  transition: Transition;
  continuousAnimation: ContinuousAnimation;
  /** URL ngoài, hoặc action nội bộ: "action:open-map:<nodeId>" */
  hyperlink: string;
}

// ─────────────────────────── Asset ───────────────────────────

/**
 * Khoá asset trên storage, KHÔNG phải URL đầy đủ:
 *   "templates/<templateId>/<uuid>.jpeg?crop=0,0,1631,2503"
 * Renderer ghép base CDN + tham số transform (resize/format/quality).
 */
export type AssetKey = string;

export interface ImageTransform {
  crop?: { x: number; y: number; w: number; h: number };
  resize?: number;   // chiều rộng đích, px
  format?: 'webp' | 'jpeg' | 'png' | 'auto';
  quality?: number;  // 1..100
}

// ─────────────────────────── Node props ───────────────────────────

export interface TextProps extends BaseProps {
  /** HTML inline hạn chế: <b> <i> <u> <br> <span style>. Có thể chứa token {{...}} */
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: '300' | '400' | '500' | '600' | '700';
  fontStyle: 'normal' | 'italic';
  color: string;
  textAlign: 'left' | 'center' | 'right' | 'justify';
  lineHeight: string;      // "normal" | "1.4"
  letterSpacing: string;   // "0" | "0.05em"
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  textDecoration: 'none' | 'underline' | 'line-through';
  /** Viền chữ — font script mảnh đặt trên ảnh rất cần cái này */
  textStroke: { width: number; color: string } | null;
}

export interface PhotoProps extends BaseProps {
  imgKey: AssetKey;
  /** PNG alpha làm mask hình dạng: "shapes/arch-01.png" */
  maskShapeImg: string | null;
  flipX: boolean;
  flipY: boolean;
  objectFit: 'cover' | 'contain';
  /** Cho phép người dùng cuối thay ảnh này khi điền thiệp */
  isReplaceable: boolean;
  /** Slot binding: lấy ảnh từ InviteData.photos[slot] nếu có */
  slot: string | null;
}

export interface ShapeProps extends BaseProps {
  /** svg: tô lại theo `color`; img: dùng nguyên bản */
  shapeKind: 'svg' | 'img';
  imgKey: AssetKey;
  color: string;
  flipX: boolean;
  flipY: boolean;
}

export interface CalendarProps extends BaseProps {
  /** Tháng hiển thị (ISO). Ngày trong tháng được vẽ ra lưới 7 cột */
  month: string;
  /** Các ngày được đánh dấu */
  markedDates: string[];
  markerIcon: AssetKey | null;
  themeColor: string;
  color: string;
  fontFamily: string;
  fontSize: number;
  weekStartsOn: 0 | 1;   // 0 = CN, 1 = T2
  showLunar: boolean;
}

export interface CountDownProps extends BaseProps {
  targetDate: string;    // ISO
  themeColor: string;
  color: string;
  fontFamily: string;
  fontSize: number;
  direction: 'horizontal' | 'vertical';
  spacing: number;
  labels: { days: string; hours: string; minutes: string; seconds: string };
  /** Hiện gì khi đã qua ngày cưới */
  expiredText: string;
}

export interface SelectOption {
  id: string;
  label: string;
}

export interface RsvpFormProps extends BaseProps {
  titleText: string;
  nameLabel: string;
  attendLabel: string;
  attendYesText: string;
  attendNoText: string;
  enableAttendeeCount: boolean;
  attendeeCountLabel: string;
  enableGuestSide: boolean;
  guestSideLabel: string;
  guestSideGroomText: string;
  guestSideBrideText: string;
  enableTransportation: boolean;
  transportationLabel: string;
  transportationSelfText: string;
  transportationPickupText: string;
  pickupDateTimeLabel: string;
  pickupTimeSlots: SelectOption[];
  enableMessage: boolean;
  messageLabel: string;
  submitText: string;
  successText: string;
  color: string;
  buttonColor: string;
  buttonTextColor: string;
  fontFamily: string;
  fontSize: number;
}

export interface GalleryPhoto {
  id: string;
  imageKey: AssetKey;
  alt: string;
}

export interface GalleryProps extends BaseProps {
  photos: GalleryPhoto[];
  layout: 'carousel' | 'grid' | 'masonry';
  showThumbnails: boolean;
  showNavButtons: boolean;
  showFullscreenButton: boolean;
  autoplay: boolean;
  autoplayInterval: number; // ms
}

export interface BankAccount {
  id: string;
  displayName: string;   // "Chú rể" / "Cô dâu"
  name: string;          // chủ tài khoản
  accountNumber: string;
  bank: string;
  qrCode: AssetKey | null;
}

export interface GiftQrProps extends BaseProps {
  imgKey: AssetKey;      // icon nút mở modal
  modalTitle: string;
  accounts: BankAccount[];
  flipX: boolean;
  flipY: boolean;
}

export interface MapProps extends BaseProps {
  label: string;
  /** Toạ độ, hoặc query text để mở Google Maps */
  lat: number | null;
  lng: number | null;
  query: string;
  mode: 'button' | 'embed';
  color: string;
  buttonColor: string;
  fontFamily: string;
  fontSize: number;
}

export interface WishesProps extends BaseProps {
  titleText: string;
  emptyText: string;
  maxVisible: number;
  color: string;
  fontFamily: string;
  fontSize: number;
}

export interface VideoProps extends BaseProps {
  source: { kind: 'youtube'; id: string } | { kind: 'file'; key: AssetKey };
  autoplay: boolean;
  loop: boolean;
  muted: boolean;
  poster: AssetKey | null;
}

// ─────────────────────────── Node union ───────────────────────────

export type NodeType =
  | 'Text' | 'Photo' | 'Shape'
  | 'Calendar' | 'CountDown' | 'RsvpForm'
  | 'Gallery' | 'GiftQr' | 'Map' | 'Wishes' | 'Video';

export interface NodeBase<T extends NodeType, P extends BaseProps> {
  id: string;
  type: T;
  /** Tên hiển thị ở panel layer */
  name: string;
  sectionId: string;
  props: P;
}

export type TemplateNode =
  | NodeBase<'Text', TextProps>
  | NodeBase<'Photo', PhotoProps>
  | NodeBase<'Shape', ShapeProps>
  | NodeBase<'Calendar', CalendarProps>
  | NodeBase<'CountDown', CountDownProps>
  | NodeBase<'RsvpForm', RsvpFormProps>
  | NodeBase<'Gallery', GalleryProps>
  | NodeBase<'GiftQr', GiftQrProps>
  | NodeBase<'Map', MapProps>
  | NodeBase<'Wishes', WishesProps>
  | NodeBase<'Video', VideoProps>;

export type PropsOf<T extends NodeType> = Extract<TemplateNode, { type: T }>['props'];

// ─────────────────────────── Document ───────────────────────────

export interface Section {
  id: string;
  name: string;
  top: Px;
  height: Px;
  /** Nền phủ toàn section, vẽ dưới mọi node của section */
  background: { color?: string; imgKey?: AssetKey } | null;
}

export interface FontDef {
  family: string;
  source: { kind: 'self'; key: AssetKey } | { kind: 'google'; name: string };
  weights: number[];
}

export interface AudioConfig {
  key: AssetKey;
  title: string;
  autoplay: boolean;
  loop: boolean;
  icon: string;
  iconColor: string;
}

export interface EffectsConfig {
  falling: {
    enabled: boolean;
    kind: 'heart' | 'petal' | 'snow' | 'custom';
    imgKey: AssetKey | null;
    density: number;
    speed: number;
  };
}

export interface Canvas {
  /** Thiết kế luôn ở bề rộng này; runtime scale = containerWidth / baseWidth */
  baseWidth: Px;
  height: Px;
  background: string;
}

export interface TemplateDoc {
  schemaVersion: number;
  id: string;
  name: string;
  slug: string;
  canvas: Canvas;
  sections: Section[];
  /** Thứ tự vẽ khi zIndex bằng nhau */
  order: string[];
  nodes: Record<string, TemplateNode>;
  fonts: FontDef[];
  audio: AudioConfig | null;
  effects: EffectsConfig;
}

// ─────────────────── Tách dữ liệu khỏi thiết kế ───────────────────

/**
 * TemplateDoc = thiết kế (dùng lại cho mọi cặp đôi).
 * InviteData  = dữ liệu của một thiệp cụ thể.
 * TextProps.text chứa token {{groom.fullName}} → resolve lúc render.
 */
export interface InviteData {
  groom: PartyInfo;
  bride: PartyInfo;
  events: EventInfo[];
  photos: Record<string, AssetKey>;  // key = PhotoProps.slot
  accounts: BankAccount[];
  message: string;
}

export interface PartyInfo {
  fullName: string;
  shortName: string;
  father: string;
  mother: string;
  address: string;
}

export interface EventInfo {
  id: string;
  title: string;
  datetime: string;   // ISO
  lunarText: string;
  venue: string;
  address: string;
  lat: number | null;
  lng: number | null;
}
