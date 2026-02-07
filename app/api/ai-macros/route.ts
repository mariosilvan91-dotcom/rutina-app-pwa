import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    if (!name) {
      return NextResponse.json({ error: "name requerido" }, { status: 400 });
    }

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: `Dame una estimación nutricional razonable por 100g para el alimento: ${name}.
Devuelve SOLO JSON con:
kcal_100, prot_100, carb_100, fat_100, ration_norm`,
      }),
    });

    const data = await res.json();
    const text = data.output_text;
    const parsed = JSON.parse(text);

    return NextResponse.json({
      name,
      kcal_100: Number(parsed.kcal_100) || 0,
      prot_100: Number(parsed.prot_100) || 0,
      carb_100: Number(parsed.carb_100) || 0,
      fat_100: Number(parsed.fat_100) || 0,
      ration_norm: Number(parsed.ration_norm) || 100,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
