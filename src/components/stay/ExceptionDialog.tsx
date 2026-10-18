import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { checkOverride } from "@/lib/demo/store";
import { useT } from "@/lib/demo/ui";

export type RoomException = { roomId: string; reason: string; code: string };

declare module "@tanstack/react-router" {
  interface HistoryState {
    /** A fill-first exception approved on a room's page, handed to the new booking it opens. */
    exception?: RoomException;
  }
}

/** The fill-first exception: the manager's code, which empty room to open, and why. */
export function ExceptionDialog({ rooms, onClose, onOpen }: { rooms: { id: string; code: string }[]; onClose: () => void; onOpen: (e: RoomException) => void }) {
  const t = useT();
  const [code, setCode] = useState("");
  const [roomId, setRoomId] = useState(rooms.length === 1 ? rooms[0].id : "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    if (!roomId) return setError(t("اختر رقم الغرفة.", "Choose the room."));
    const res = checkOverride({ roomId, reason, code }, roomId);
    if (!res.ok) return setError(res.error);
    onOpen({ roomId, reason: reason.trim(), code });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("فتح غرفة فاضية (تحتاج إذن)", "Open an empty room (needs approval)")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {/* Not a login: keep browsers and password managers from filling in a saved password. */}
          <Field label={t("كلمة سر المدير", "Manager's code")}><Input type="password" inputMode="numeric" autoComplete="new-password" name="manager-approval-code" data-1p-ignore data-lpignore="true" data-form-type="other" autoFocus value={code} onChange={(e) => { setCode(e.target.value); setError(null); }} /></Field>
          {/* With one room there's nothing to choose: it is the room being opened. */}
          {rooms.length === 1 ? (
            <p className="text-sm">{t("الغرفة:", "Room:")} <b>{rooms[0].code}</b></p>
          ) : (
            <Field label={t("رقم الغرفة", "Room")}>
              <Select value={roomId} onValueChange={(v) => { setRoomId(v); setError(null); }}>
                <SelectTrigger><SelectValue placeholder={t("اختر الغرفة", "Choose a room")} /></SelectTrigger>
                <SelectContent>{rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.code}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          )}
          <Field label={t("السبب", "Reason")}><Input placeholder={t("مثل: مجموعة أصحاب", "e.g. a group of friends")} value={reason} onChange={(e) => { setReason(e.target.value); setError(null); }} /></Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{t("إلغاء", "Cancel")}</Button>
          <Button onClick={submit}>{t("فتح الغرفة", "Open the room")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
