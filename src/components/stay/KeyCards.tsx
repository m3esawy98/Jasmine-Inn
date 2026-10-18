import { useState } from "react";
import { KeyRound, Loader2, Nfc } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pill, run } from "@/components/stay/kit";
import { actions, bookingCards, can, cardBlocker, cardState, MAX_CARDS, useDemo } from "@/lib/demo/store";
import type { Booking, KeyCard } from "@/lib/demo/types";
import { useDate, useT } from "@/lib/demo/ui";
import { cn } from "@/lib/utils";

/** How long the demo pretends the encoder takes to write a card. */
const ENCODE_MS = 1500;

export const CARD_STATE: Record<ReturnType<typeof cardState>, [string, string, string]> = {
  active: ["نشط", "Active", "success"],
  expired: ["منتهي", "Expired", "warning"],
  cancelled: ["ملغي", "Cancelled", "muted"],
};

/** A guest's room cards: encode one (only for a checked-in stay), add a second, or replace a lost one. */
export function KeyCardPanel({ b, onEncoded }: { b: Booking; onEncoded?: () => void }) {
  const s = useDemo();
  const t = useT();
  const fmt = useDate();
  const cards = bookingCards(s, b.id);
  const live = cards.filter((k) => cardState(k) === "active");
  const blocked = cardBlocker(s, b);
  const allowed = can(s.role, "stay.checkin");
  const student = s.properties.find((p) => p.id === s.rooms.find((r) => r.id === s.beds.find((x) => x.id === b.bedId)?.roomId)?.propertyId)?.type === "student";
  const [encoding, setEncoding] = useState(false);
  const [replacing, setReplacing] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  // The encoder "writes" the card for a moment before the system records it.
  const encode = (replace?: KeyCard) => {
    setEncoding(true);
    setTimeout(() => {
      const res = replace ? actions.replaceCard(replace.id, reason) : actions.issueCard(b.id);
      run(res, res.ok ? t(`تم تكويد الكارت ${res.data!.code}`, `Card ${res.data!.code} encoded`) : "");
      setEncoding(false);
      if (res.ok) { setReplacing(null); setReason(""); onEncoded?.(); }
    }, ENCODE_MS);
  };
  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="size-4 text-primary" />{t("كارت الغرفة", "Room card")}</p>
        <span className="text-[11px] text-muted-foreground">{student ? t("يفتح الغرفة وبوابة المبنى", "Opens the room and the building gate") : t("يفتح الغرفة", "Opens the room")}</span>
      </div>
      {encoding ? (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-primary-soft p-3 text-sm text-primary"><Loader2 className="size-4 animate-spin" />{t("ضع الكارت على جهاز التكويد…", "Place the card on the encoder…")}</p>
      ) : (
        <>
          {cards.length > 0 && (
            <ul className="mt-3 divide-y text-sm">
              {cards.map((k) => {
                const state = cardState(k);
                return (
                  <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className={cn(state !== "active" && "text-muted-foreground")}>
                      <b className="tabular-nums">{k.code}</b> <Pill tone={CARD_STATE[state][2]}>{t(CARD_STATE[state][0], CARD_STATE[state][1])}</Pill>
                      <span className="block text-xs text-muted-foreground">
                        {state === "cancelled" ? t(`أُلغي: ${k.cancelReason ?? ""}`, `Cancelled: ${k.cancelReason ?? ""}`) : t(`صالح حتى ${fmt(k.validUntil, true)}`, `Valid until ${fmt(k.validUntil, true)}`)}
                      </span>
                    </span>
                    {state === "active" && allowed && replacing !== k.id && (
                      <Button variant="link" className="h-auto p-0 text-xs" onClick={() => { setReplacing(k.id); setReason(""); }}>{t("بدل فاقد", "Replace lost card")}</Button>
                    )}
                    {replacing === k.id && (
                      <div className="flex w-full flex-wrap items-center gap-2">
                        <Input className="h-8 max-w-xs text-xs" autoFocus placeholder={t("سبب بدل الفاقد", "Why it's being replaced")} value={reason} onChange={(e) => setReason(e.target.value)} />
                        <Button size="sm" disabled={!reason.trim()} onClick={() => encode(k)}><Nfc className="size-4" />{t("إلغاء القديم وتكويد بديل", "Cancel it and encode a new one")}</Button>
                        <Button size="sm" variant="ghost" onClick={() => setReplacing(null)}>{t("إلغاء", "Cancel")}</Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {blocked ? (
            <p className="mt-3 text-xs text-muted-foreground">{blocked}</p>
          ) : (
            live.length < MAX_CARDS && (
              <Button className="mt-3 w-full" variant={live.length ? "outline" : "default"} disabled={!allowed} onClick={() => encode()}>
                <Nfc className="size-4" />{live.length ? t("تكويد كارت إضافي", "Encode a second card") : t("تكويد كارت الغرفة", "Encode the room card")}
              </Button>
            )
          )}
        </>
      )}
    </div>
  );
}
