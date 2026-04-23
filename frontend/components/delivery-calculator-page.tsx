"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { SarmaExpressHeader } from "@/components/sarma-express-header";

const cargoTypeOptions = ["Документы", "Коробки и посылки", "Сборный груз", "Паллеты", "Хрупкий груз"];
const extraServiceOptions = [
  "Без дополнительных услуг",
  "Страхование",
  "Забор с адреса",
  "Доставка до двери",
  "Хрупкий груз",
];

type CalculatorState = {
  from: string;
  to: string;
  weight: string;
  volume: string;
  cargoType: string;
  extraServices: string;
};

const initialState: CalculatorState = {
  from: "",
  to: "",
  weight: "",
  volume: "",
  cargoType: cargoTypeOptions[0],
  extraServices: extraServiceOptions[0],
};

const fieldClassName =
  "calculator-field-input mt-1.5 w-full appearance-none border-none bg-transparent p-0 text-base font-bold text-[#173862] shadow-none outline-none ring-0 placeholder:text-[#8aa2c8] focus:border-none focus:outline-none focus:ring-0 focus-visible:outline-none";

export function DeliveryCalculatorPage() {
  const [cargoType, setCargoType] = useState(initialState.cargoType);
  const [extraServices, setExtraServices] = useState(initialState.extraServices);

  return (
    <main className="min-h-screen bg-[#edf2f8] text-[#12243f]">
      <SarmaExpressHeader activeItem="calculator" />

      <section
        className="relative overflow-hidden bg-[#4a8de7] bg-cover bg-[position:72%_center] bg-no-repeat"
        style={{ backgroundImage: "url('/brand/hero-background.png')" }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(51,114,214,0.96)_0%,rgba(86,148,232,0.82)_34%,rgba(150,198,248,0.26)_64%,rgba(255,255,255,0)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_24%,rgba(255,255,255,0.6),transparent_17%),linear-gradient(90deg,rgba(255,255,255,0)_46%,rgba(255,255,255,0.74)_100%)]" />
        <div className="absolute -left-28 top-1/2 h-[580px] w-[580px] -translate-y-1/2 rounded-full border border-white/18" />
        <div className="absolute -left-10 bottom-[-180px] h-[440px] w-[440px] rounded-full border border-white/18" />
        <div className="absolute left-[5%] top-[34%] hidden h-36 w-44 opacity-35 lg:block">
          <DotPattern />
        </div>

        <div className="relative mx-auto flex min-h-[calc(100vh-92px)] w-full max-w-[1320px] items-start justify-center px-4 py-12 lg:px-6 lg:py-16">
          <div className="relative z-10 w-full max-w-[590px]">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/36 bg-white/12 px-4 py-2 text-sm font-semibold text-white/92 backdrop-blur-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-[#9fd0ff]" />
              Предварительный расчет
            </div>

            <h1 className="mt-6 max-w-[640px] text-4xl font-extrabold leading-[1.05] text-white drop-shadow-[0_16px_34px_rgba(20,56,120,0.22)] sm:text-5xl lg:text-[4rem]">
              Калькулятор
              <br />
              доставки
            </h1>

            <p className="mt-5 max-w-[560px] text-base leading-7 text-white/86 sm:text-lg">
              Страница уже готова для маршрута и интерфейса. Точные тарифы подключим позже, когда вы передадите формулы расчета.
            </p>

            <form
              className="mt-8 rounded-[32px] border border-white/46 bg-[linear-gradient(180deg,rgba(244,249,255,0.3)_0%,rgba(226,238,255,0.2)_100%)] p-5 shadow-[0_28px_80px_rgba(28,78,160,0.24)] backdrop-blur-[20px] sm:p-7"
              onSubmit={(event) => {
                event.preventDefault();
              }}
            >
              <div className="grid gap-4">
                <FieldShell icon={<PinIcon />} label="Откуда">
                  <input
                    placeholder="Город отправления"
                    className={fieldClassName}
                  />
                </FieldShell>

                <FieldShell icon={<PinIcon />} label="Куда">
                  <input
                    placeholder="Город назначения"
                    className={fieldClassName}
                  />
                </FieldShell>

                <div className="grid gap-4 md:grid-cols-2">
                  <FieldShell icon={<WeightIcon />} label="Вес груза, кг">
                    <input
                      placeholder="Например, 120"
                      inputMode="decimal"
                      className={fieldClassName}
                    />
                  </FieldShell>

                  <FieldShell icon={<VolumeIcon />} label="Объем, м³">
                    <input
                      placeholder="Например, 1.8"
                      inputMode="decimal"
                      className={fieldClassName}
                    />
                  </FieldShell>
                </div>

                <FieldShell icon={<CargoIcon />} label="Тип груза">
                  <ModernSelect options={cargoTypeOptions} value={cargoType} onChange={setCargoType} />
                </FieldShell>

                <FieldShell icon={<ShieldIcon />} label="Дополнительные услуги">
                  <ModernSelect options={extraServiceOptions} value={extraServices} onChange={setExtraServices} />
                </FieldShell>

                <button
                  type="submit"
                  className="mt-4 inline-flex min-h-14 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,#4f8fe8_0%,#356fcb_100%)] px-8 text-lg font-extrabold text-white shadow-[0_22px_38px_rgba(30,74,156,0.32)] hover:-translate-y-0.5"
                >
                  Рассчитать стоимость
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}

function ModernSelect({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="relative mt-1.5">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 rounded-[18px] bg-transparent text-left text-base font-bold text-[#173862] outline-none"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="truncate">{value}</span>
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d7e5fb] bg-[linear-gradient(180deg,#f8fbff_0%,#ebf3ff_100%)] text-[#3f74cb] shadow-[0_8px_18px_rgba(47,96,184,0.12)] transition ${isOpen ? "rotate-180 border-[#bfd5f7] bg-[linear-gradient(180deg,#eef5ff_0%,#dfeeff_100%)]" : ""}`}
        >
          <ChevronDownIcon />
        </span>
      </button>

      <div
        className={`absolute left-0 right-0 top-[calc(100%+12px)] z-30 origin-top rounded-[22px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(235,244,255,0.94)_100%)] p-2.5 shadow-[0_30px_55px_rgba(24,66,140,0.2)] backdrop-blur-xl transition duration-200 ${isOpen ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"}`}
      >
        <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
          {options.map((option) => {
            const selected = option === value;

            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={selected}
                className={`flex w-full items-center justify-between gap-3 rounded-[16px] px-4 py-3 text-left transition ${
                  selected
                    ? "bg-[linear-gradient(135deg,#4f8fe8_0%,#3e76cf_100%)] text-white shadow-[0_16px_28px_rgba(46,90,175,0.24)]"
                    : "bg-white/55 text-[#173862] hover:bg-white/92 hover:shadow-[0_12px_22px_rgba(34,78,154,0.12)]"
                }`}
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
              >
                <span className="truncate text-[15px] font-semibold">{option}</span>
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition ${
                    selected
                      ? "border-white/35 bg-white/18 text-white"
                      : "border-[#d7e4f7] bg-white/72 text-[#7e95ba]"
                  }`}
                >
                  {selected ? <CheckIcon /> : <DotIcon />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FieldShell({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="calculator-field-shell flex items-center gap-3 rounded-[22px] border border-white/58 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(240,246,255,0.9)_100%)] px-4 py-4 text-[#173862] shadow-[0_16px_30px_rgba(28,78,160,0.12),inset_0_1px_0_rgba(255,255,255,0.75)]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(180deg,#edf5ff_0%,#dce9ff_100%)] text-[#3c75d0] shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]">{icon}</span>
      <div className="min-w-0 flex-1">
        <span className="block text-xs font-black uppercase tracking-[0.18em] text-[#17212f]">{label}</span>
        {children}
      </div>
    </label>
  );
}

function DotPattern() {
  return (
    <svg viewBox="0 0 176 144" className="h-full w-full fill-white/45" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, row) =>
        Array.from({ length: 11 }).map((_, column) => (
          <circle key={`${row}-${column}`} cx={12 + column * 15} cy={12 + row * 15} r={row > 5 && column > 8 ? 0 : 4.2} />
        )),
      )}
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s6-5.7 6-10.3A6 6 0 1 0 6 10.7C6 15.3 12 21 12 21Z" />
      <circle cx="12" cy="10" r="2.4" />
    </svg>
  );
}

function WeightIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8.4 7.4 10.2 4h3.6l1.8 3.4" />
      <path d="M6 8h12l1 10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L6 8Z" />
      <path d="M12 11.5v4" />
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" />
      <path d="M4 7.5 12 12l8-4.5" />
      <path d="M12 12v9" />
    </svg>
  );
}

function CargoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 8.2 12 3l8.5 5.2v7.6L12 21l-8.5-5.2V8.2Z" />
      <path d="M12 3v18" />
      <path d="m3.5 8.2 8.5 5.1 8.5-5.1" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3 5 6v5.7c0 4.7 2.8 7.9 7 9.3 4.2-1.4 7-4.6 7-9.3V6l-7-3Z" />
      <path d="m9.2 12.4 1.9 1.9 3.8-4.2" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.2 4.2L19 7.8" />
    </svg>
  );
}

function DotIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" />
    </svg>
  );
}
