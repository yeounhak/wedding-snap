import type { Metadata } from "next";

import { DocList, DocNote, DocSection, DocTitle } from "../_components/doc";

export const metadata: Metadata = {
  title: "환불·청약철회 안내 · Wedding Snap",
};

export default function RefundPage() {
  return (
    <>
      <DocTitle title="환불·청약철회 안내" effective="2026년 5월 27일" />
      <DocNote>
        본 문서는 초안입니다. 아래 [ ] 안의 판매자 정보를 실제 사업자 정보로
        채우고, 서비스 출시 전 반드시 법률 검토를 받으세요.
      </DocNote>

      <DocSection title="판매자 정보">
        <DocList
          items={[
            <>상호: 웨딩스냅</>,
            <>대표자: 여운학</>,
            <>사업자등록번호: 694-50-01245</>,
            <>통신판매업 신고번호: [통신판매업 신고번호]</>,
            <>
              사업장 주소: 서울특별시 서대문구 홍은중앙로11길 31 (홍은동,
              서대문센트럴아이파크)
            </>,
            <>고객센터: [이메일 / 전화번호]</>,
            <>호스팅 제공자: [호스팅 제공자]</>,
          ]}
        />
      </DocSection>

      <DocSection title="판매 상품 및 가격">
        <p>
          본 서비스는 워터마크 없는 사진을 생성할 수 있는 디지털 콘텐츠인
          “크레딧”을 판매합니다. 상품 구성과 가격은 결제 화면에 표시된 내용을
          따릅니다(예: 5장 크레딧 ₩3,900).
        </p>
      </DocSection>

      <DocSection title="청약철회 및 환불">
        <DocList
          items={[
            <>이용자는 결제일로부터 7일 이내에 청약철회를 요청할 수 있습니다.</>,
            <>아직 사용하지 않은 크레딧은 전액 환불됩니다.</>,
            <>
              「전자상거래 등에서의 소비자보호에 관한 법률」 제17조에 따라, 이미
              사진 생성에 사용되어 콘텐츠 제공이 개시된 크레딧은 청약철회가 제한될
              수 있습니다.
            </>,
            <>
              회사의 귀책사유(생성 실패 등)로 크레딧이 정상 제공되지 않은 경우,
              해당 크레딧은 자동 복구되거나 환불됩니다.
            </>,
          ]}
        />
      </DocSection>

      <DocSection title="환불 방법 및 처리 기간">
        <p>
          환불은 원칙적으로 결제하신 수단으로 이루어지며, 환불 요청이 접수된
          날로부터 영업일 기준 [N]일 이내에 처리됩니다. 결제 수단의 사정에 따라
          실제 환불 시점은 달라질 수 있습니다.
        </p>
      </DocSection>

      <DocSection title="환불 문의">
        <p>
          환불 및 청약철회는 [고객센터 이메일]로 주문번호와 함께 요청해 주시면
          안내해 드립니다.
        </p>
      </DocSection>
    </>
  );
}
