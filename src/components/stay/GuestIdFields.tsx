import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { idNumberValid } from "@/lib/demo/store";
import type { IdType } from "@/lib/demo/types";
import { useT } from "@/lib/demo/ui";

export interface GuestIdValue {
  idType: IdType;
  idNumber: string;
  nationality: string;
}

/** ID document type (national ID or passport), its number and, for passports, the nationality. */
export function GuestIdFields({
  value,
  onChange,
}: {
  value: GuestIdValue;
  onChange: (v: GuestIdValue) => void;
}) {
  const t = useT();
  const passport = value.idType === "passport";
  const invalid = value.idNumber.trim() !== "" && !idNumberValid(value.idType, value.idNumber);
  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t("نوع الهوية", "ID type")}</Label>
        <Select
          value={value.idType}
          // A number typed for one document type is never valid for the other, so start fresh.
          onValueChange={(v) =>
            v !== value.idType && onChange({ ...value, idType: v as IdType, idNumber: "" })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="national_id">
              {t("بطاقة رقم قومي (مصري)", "National ID (Egyptian)")}
            </SelectItem>
            <SelectItem value="passport">
              {t("جواز سفر (أجنبي)", "Passport (international)")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {passport
            ? t("رقم جواز السفر", "Passport number")
            : t("الرقم القومي", "National ID number")}
        </Label>
        <Input
          dir="ltr"
          value={value.idNumber}
          inputMode={passport ? "text" : "numeric"}
          maxLength={passport ? 9 : 14}
          placeholder={passport ? "A1234567" : "29901011234567"}
          aria-invalid={invalid}
          onChange={(e) =>
            onChange({
              ...value,
              idNumber: passport ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, ""),
            })
          }
        />
        {invalid && (
          <p className="text-xs text-destructive">
            {passport
              ? t("من 6 إلى 9 حروف لاتينية أو أرقام", "6–9 Latin letters or digits")
              : t("14 رقمًا", "14 digits")}
          </p>
        )}
      </div>
      {passport && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("الجنسية", "Nationality")}</Label>
          <Input
            value={value.nationality}
            onChange={(e) => onChange({ ...value, nationality: e.target.value })}
          />
        </div>
      )}
    </>
  );
}
