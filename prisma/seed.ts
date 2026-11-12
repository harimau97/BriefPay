import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const criteria = [
  "The hero shows the product name and a call-to-action button",
  "A pricing section lists 3 plans",
  "The call-to-action stays visible at a mobile width",
  "The page includes a contact form",
];

const legacyCriteria: Record<string, string> = {
  "히어로 영역에 제품명과 CTA 버튼이 있다": criteria[0],
  "가격표 섹션이 있고 플랜이 3개다": criteria[1],
  "모바일 너비에서도 CTA가 보인다": criteria[2],
  "연락처 또는 문의 폼이 있다": criteria[3],
};

const seedBrief = [
  "Rebuild the Sori practice-room landing page.",
  "Visitors should recognize the product name, compare three prices, and be able to send a message.",
  "The main action should stay visible on a narrow screen.",
  "Submit the work as a public URL. Pass example: /demo/pass. Fail example: /demo/fail.",
].join("\n");

const legacySeedBrief = [
  "Sori 연습실 예약 서비스의 랜딩페이지를 다시 만듭니다.",
  "방문자가 제품명을 바로 알아보고, 세 가지 가격을 비교하고, 문의할 수 있어야 합니다.",
  "좁은 화면에서도 주요 행동 버튼이 보여야 합니다.",
  "결과물은 공개 URL로 제출합니다. 통과 예시 /demo/pass, 반려 예시 /demo/fail.",
].join("\n");

const legacyBriefs: Record<string, string> = {
  [legacySeedBrief]: seedBrief,
  "Sori 연습실 예약 랜딩을 다시 만듭니다. 제품명과 CTA, 요금제 3개, 모바일에서 보이는 버튼, 문의 폼이 있어야 합니다.":
    "Rebuild the Sori practice-room landing page. It needs the product name and a CTA, three pricing plans, a button that stays visible on mobile, and a contact form.",
};

async function main() {
  const client = await prisma.user.upsert({
    where: { email: "client@demo.com" },
    update: { name: "Demo client", role: "CLIENT" },
    create: {
      id: "user_client",
      email: "client@demo.com",
      name: "Demo client",
      role: "CLIENT",
    },
  });

  await prisma.user.upsert({
    where: { email: "freelancer@demo.com" },
    update: { name: "Demo freelancer", role: "FREELANCER" },
    create: {
      id: "user_freelancer",
      email: "freelancer@demo.com",
      name: "Demo freelancer",
      role: "FREELANCER",
    },
  });

  const existing = await prisma.job.findUnique({ where: { id: "job_landing" } });
  if (!existing) {
    const due = new Date();
    due.setDate(due.getDate() + 3);
    await prisma.job.create({
      data: {
        id: "job_landing",
        title: "Landing page redesign",
        brief: seedBrief,
        budgetCents: 15000,
        currency: "USD",
        dueAt: due,
        status: "DRAFT",
        clientId: client.id,
        criteria: {
          create: criteria.map((label, sortOrder) => ({ label, sortOrder })),
        },
        events: {
          create: { type: "CREATED", payload: JSON.stringify({ source: "seed" }) },
        },
      },
    });
    console.log("Seeded client@demo.com, freelancer@demo.com, and job_landing.");
  } else {
    console.log("Seed job already exists. Leaving its status untouched.");
  }

  const retitled = await prisma.job.updateMany({
    where: { title: "랜딩페이지 리뉴얼" },
    data: { title: "Landing page redesign" },
  });
  let briefs = 0;
  for (const [from, to] of Object.entries(legacyBriefs)) {
    const updated = await prisma.job.updateMany({ where: { brief: from }, data: { brief: to } });
    briefs += updated.count;
  }
  let labels = 0;
  for (const [from, to] of Object.entries(legacyCriteria)) {
    const updated = await prisma.criterion.updateMany({ where: { label: from }, data: { label: to } });
    labels += updated.count;
  }
  console.log(`Updated display copy. Jobs retitled: ${retitled.count}. Briefs: ${briefs}. Criteria: ${labels}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
