"use client";

const colors: Record<string, { bg: string; text: string }> = {
  ETH: { bg: "bg-blue-500/15", text: "text-blue-400" },
  USDC: { bg: "bg-green-500/15", text: "text-green-400" },
  STRK: { bg: "bg-orange-500/15", text: "text-orange-400" },
};

export default function TokenIcon({
  symbol,
  size = "md",
}: {
  symbol: string;
  size?: "sm" | "md" | "lg";
}) {
  const c = colors[symbol] || { bg: "bg-primary-soft", text: "text-primary" };
  const sizes = {
    sm: "w-6 h-6 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-10 h-10 text-base",
  };

  return (
    <div
      className={`${sizes[size]} rounded-full ${c.bg} ${c.text} flex items-center justify-center font-bold shrink-0`}
    >
      {symbol[0]}
    </div>
  );
}
