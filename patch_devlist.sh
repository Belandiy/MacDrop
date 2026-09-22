cat << 'DIFF' > devlist.diff
<<<<<<< SEARCH
const DeviceListItem: React.FC<DeviceListItemProps> = ({ device, onClick, onQuickSend }) => {
  const isMac = device.id.startsWith('MAC') || device.originalName.toLowerCase().includes('mac');

  return (
=======
const DeviceListItem: React.FC<DeviceListItemProps> = ({ device, onClick, onQuickSend }) => {
  const isMobile = device.id === 'mobile-web';
  const isMac = device.id.startsWith('MAC') || device.originalName.toLowerCase().includes('mac');

  return (
>>>>>>> REPLACE
<<<<<<< SEARCH
              : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
          }`}>
            {isMac ? <Laptop className="w-4.5 h-4.5" /> : <Monitor className="w-4.5 h-4.5" />}
          </div>
=======
              : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
          }`}>
            {isMobile ? <Smartphone className="w-4.5 h-4.5" /> : isMac ? <Laptop className="w-4.5 h-4.5" /> : <Monitor className="w-4.5 h-4.5" />}
          </div>
>>>>>>> REPLACE
DIFF
