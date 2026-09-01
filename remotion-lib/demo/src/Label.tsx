/** Section caption for the demo. Not part of the library. */
import React from 'react';
import { THEME } from './theme';

export const Label: React.FC<{ title: string; note: string }> = ({ title, note }) => (
  <div
    style={{
      position: 'absolute',
      left: 64,
      top: 56,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    }}
  >
    <div style={{ color: THEME.textBright, fontSize: 34, letterSpacing: 1 }}>{title}</div>
    <div style={{ color: THEME.text, fontSize: 19, marginTop: 8 }}>{note}</div>
  </div>
);
