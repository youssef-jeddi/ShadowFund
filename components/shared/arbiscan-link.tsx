import { ARBISCAN_BASE_URL } from "@/lib/config";

interface ArbiscanLinkProps {
  txHash: string;
  label?: string;
  className?: string;
}

export function ArbiscanLink({
  txHash,
  label = "View on Arbiscan",
  className,
}: ArbiscanLinkProps) {
  return (
    <a
      href={`${ARBISCAN_BASE_URL}/tx/${txHash}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 font-mulish text-sm font-medium text-primary hover:underline ${className ?? ""}`}
    >
      {label}
      <span className="material-icons text-[14px]!">open_in_new</span>
    </a>
  );
}
