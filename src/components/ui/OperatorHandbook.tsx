import { DocCenter } from './DocCenter'

interface OperatorHandbookProps {
  onClose: () => void
}

export function OperatorHandbook({ onClose }: OperatorHandbookProps) {
  return <DocCenter onClose={onClose} />
}
