'use server';

import { revalidatePath } from 'next/cache';

export async function refreshTournamentData() {
    revalidatePath('/');
}
