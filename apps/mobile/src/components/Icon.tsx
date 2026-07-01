import React from 'react';
import Svg, { Path, Circle, Rect, Line, Polyline } from 'react-native-svg';

/**
 * Lightweight Feather-style line icons rendered with react-native-svg.
 * Professional, consistent stroke icons — no emoji, no native font linking.
 */
export type IconName =
  | 'home' | 'tag' | 'calendar' | 'user' | 'users' | 'check-square' | 'bar-chart'
  | 'pie-chart' | 'inbox' | 'briefcase' | 'bell' | 'clock' | 'log-out' | 'box'
  | 'credit-card' | 'shield' | 'help-circle' | 'chevron-right' | 'settings' | 'file-text';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export default function Icon({ name, size = 24, color = '#1F2937', strokeWidth = 2 }: Props) {
  const common = {
    stroke: color,
    strokeWidth,
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {render(name, common)}
    </Svg>
  );
}

function render(name: IconName, p: any) {
  switch (name) {
    case 'home':
      return (<>
        <Path {...p} d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
      </>);
    case 'tag':
      return (<>
        <Path {...p} d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <Line {...p} x1="7" y1="7" x2="7.01" y2="7" />
      </>);
    case 'calendar':
      return (<>
        <Rect {...p} x="3" y="4" width="18" height="17" rx="2" />
        <Line {...p} x1="16" y1="2" x2="16" y2="6" />
        <Line {...p} x1="8" y1="2" x2="8" y2="6" />
        <Line {...p} x1="3" y1="10" x2="21" y2="10" />
      </>);
    case 'user':
      return (<>
        <Path {...p} d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <Circle {...p} cx="12" cy="7" r="4" />
      </>);
    case 'users':
      return (<>
        <Path {...p} d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <Circle {...p} cx="9" cy="7" r="4" />
        <Path {...p} d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <Path {...p} d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>);
    case 'check-square':
      return (<>
        <Polyline {...p} points="9 11 12 14 22 4" />
        <Path {...p} d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </>);
    case 'bar-chart':
      return (<>
        <Line {...p} x1="18" y1="20" x2="18" y2="10" />
        <Line {...p} x1="12" y1="20" x2="12" y2="4" />
        <Line {...p} x1="6" y1="20" x2="6" y2="14" />
      </>);
    case 'pie-chart':
      return (<>
        <Path {...p} d="M21.21 15.89A10 10 0 1 1 8 2.83" />
        <Path {...p} d="M22 12A10 10 0 0 0 12 2v10z" />
      </>);
    case 'inbox':
      return (<>
        <Polyline {...p} points="22 12 16 12 14 15 10 15 8 12 2 12" />
        <Path {...p} d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      </>);
    case 'briefcase':
      return (<>
        <Rect {...p} x="2" y="7" width="20" height="14" rx="2" />
        <Path {...p} d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </>);
    case 'bell':
      return (<>
        <Path {...p} d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <Path {...p} d="M13.73 21a2 2 0 0 1-3.46 0" />
      </>);
    case 'clock':
      return (<>
        <Circle {...p} cx="12" cy="12" r="9" />
        <Polyline {...p} points="12 7 12 12 15 14" />
      </>);
    case 'log-out':
      return (<>
        <Path {...p} d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <Polyline {...p} points="16 17 21 12 16 7" />
        <Line {...p} x1="21" y1="12" x2="9" y2="12" />
      </>);
    case 'box':
      return (<>
        <Path {...p} d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <Polyline {...p} points="3.27 6.96 12 12.01 20.73 6.96" />
        <Line {...p} x1="12" y1="22" x2="12" y2="12" />
      </>);
    case 'credit-card':
      return (<>
        <Rect {...p} x="1" y="4" width="22" height="16" rx="2" />
        <Line {...p} x1="1" y1="10" x2="23" y2="10" />
      </>);
    case 'shield':
      return (<Path {...p} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />);
    case 'help-circle':
      return (<>
        <Circle {...p} cx="12" cy="12" r="10" />
        <Path {...p} d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <Line {...p} x1="12" y1="17" x2="12.01" y2="17" />
      </>);
    case 'settings':
      return (<>
        <Circle {...p} cx="12" cy="12" r="3" />
        <Path {...p} d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </>);
    case 'file-text':
      return (<>
        <Path {...p} d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <Polyline {...p} points="14 2 14 8 20 8" />
        <Line {...p} x1="16" y1="13" x2="8" y2="13" />
        <Line {...p} x1="16" y1="17" x2="8" y2="17" />
      </>);
    case 'chevron-right':
      return (<Polyline {...p} points="9 18 15 12 9 6" />);
    default:
      return null;
  }
}
