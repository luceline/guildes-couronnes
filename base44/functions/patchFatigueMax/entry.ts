import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Récupère tous les personnages
    const allProfiles = await base44.asServiceRole.entities.PlayerProfile.list();
    
    const patchedProfiles = [];
    
    for (const profile of allProfiles) {
      if ((profile.fatigue || 0) > 20) {
        await base44.asServiceRole.entities.PlayerProfile.update(profile.id, { fatigue: 20 });
        patchedProfiles.push({ id: profile.id, name: profile.character_name, oldFatigue: profile.fatigue });
      }
    }

    return Response.json({
      success: true,
      message: `Patched ${patchedProfiles.length} profiles`,
      patched: patchedProfiles
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});