import { useSelection } from '../store';

export default function Crosshair() {
  const { selection } = useSelection();
  return <div className={`crosshair${selection ? ' locked' : ''}`} />;
}
