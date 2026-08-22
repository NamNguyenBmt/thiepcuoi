/**
 * NodeType → component.
 *
 * Thêm một loại node mới = thêm props vào schema, thêm default, thêm 1 dòng ở
 * đây. Editor lấy đúng bảng này để dựng thanh công cụ, nên không có chuyện
 * schema có node mà editor chưa biết vẽ.
 */

import type { ComponentType } from 'react';
import type { NodeType, TemplateNode } from '@thiepcuoi/schema';
import { TextNode, PhotoNode, ShapeNode } from './nodes/basic';
import { EnvelopeNode } from './nodes/envelope';
import { CalendarNode, CountDownNode } from './nodes/date';
import { RsvpFormNode, WishesNode, MapNode, GiftQrNode } from './nodes/interactive';
import { GalleryNode, VideoNode } from './nodes/media';

type AnyNodeComponent = ComponentType<{ node: any }>;

export const NODE_REGISTRY: Record<NodeType, AnyNodeComponent> = {
  Text: TextNode,
  Photo: PhotoNode,
  Shape: ShapeNode,
  Envelope: EnvelopeNode,
  Calendar: CalendarNode,
  CountDown: CountDownNode,
  RsvpForm: RsvpFormNode,
  Gallery: GalleryNode,
  GiftQr: GiftQrNode,
  Map: MapNode,
  Wishes: WishesNode,
  Video: VideoNode,
};

export function componentFor(node: TemplateNode): AnyNodeComponent | null {
  return NODE_REGISTRY[node.type] ?? null;
}
