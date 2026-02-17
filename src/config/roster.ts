export interface Player {
  id: string;      // Epic Account ID
  username: string; // Display Name for lookup (prefix/full)
  name: string;     // Friendly Name
}

export const ROSTER: Player[] = [
  { id: 'd706641c93524ceba9cd195b5e287d98', username: 'Akiira', name: 'Akiira' },
  { id: 'f0d8961f20d04631a6b2abda24a17070', username: 'MariusCOW', name: 'MariusCOW' },
  { id: '5bec82879fbf436887597f49d9bcc7c3', username: 'Merstach', name: 'Merstach' },
  { id: '79f1994f55eb4931a148935efa188b2f', username: 'Vanyak3k', name: 'Vanyak3k' }
];
