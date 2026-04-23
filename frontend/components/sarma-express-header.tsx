"use client";

import Image from "next/image";
import Link from "next/link";

const navigationItems = [
  { key: "calculator", label: "Калькулятор", href: "/calculator" },
  { key: "tracking", label: "Отслеживание", href: "/superbox?flow=order_lookup" },
  { key: "business", label: "Бизнесу", href: "/superbox?flow=business" },
  { key: "tariffs", label: "Тарифы", href: "/superbox?flow=tariffs" },
  { key: "internet-delivery", label: "Доставка из интернет-магазинов", href: "/superbox?flow=pickup_paid" },
  { key: "russia", label: "Отправления в РФ", href: "/superbox?flow=ship_russia" },
  { key: "pickup-points", label: "Пункты выдачи", href: "/pickup-points" },
];

export function SarmaExpressHeader({ activeItem }: { activeItem?: string }) {
  return (
    <div className="sticky top-3 z-50 px-3 pt-3 sm:px-4 lg:px-5">
      <header className="mx-auto w-full max-w-[1706px] rounded-[36px] border border-[#d9e1ef] bg-white/95 shadow-[0_18px_44px_rgba(16,45,88,0.08)] backdrop-blur-xl">
        <div className="mx-auto flex w-full flex-col gap-3 px-8 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <Link href="/" className="shrink-0">
            <SarmaExpressLogo />
          </Link>

          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px] font-semibold text-[#12243f] lg:flex-nowrap lg:justify-end">
            {navigationItems.map((item) => {
              const isActive = item.key === activeItem;

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`rounded-full px-4 py-2 transition-all duration-200 ${
                    isActive
                      ? "bg-[#edf4ff] text-[#2c6ed3] shadow-[inset_0_0_0_1px_rgba(44,110,211,0.08)]"
                      : "hover:bg-[#f6f9ff] hover:text-[#2c6ed3]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
    </div>
  );
}

export function SarmaExpressLogo({ onTruck = false }: { onTruck?: boolean }) {
  if (onTruck) {
    return (
      <div className="relative h-[56px] w-[258px] overflow-hidden">
        <Image
          src="/brand/sarma-express-logo-cropped.png"
          alt="Сарма Экспресс"
          fill
          sizes="258px"
          className="object-contain object-left scale-[1.02]"
        />
      </div>
    );
  }

  return (
    <div className="relative h-[56px] w-[300px] overflow-hidden sm:h-[64px] sm:w-[340px]">
      <Image
        src="/brand/sarma-express-logo-header-final.png"
        alt="Сарма Экспресс"
        fill
        priority
        sizes="(max-width: 640px) 300px, 340px"
        className="object-contain object-left"
      />
    </div>
  );
}
