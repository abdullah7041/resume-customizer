// Short, request-local labels keep the model from having to transcribe two
// hashes per citation. Returned cards still go through exact quote/target validation.
export function labelOptimizeSources(sources) {
  const targets = new Map();
  const sourceIds = new Map();
  const targetIds = new Map();
  const labelled = sources.map((source, i) => {
    let target = targets.get(source.targetId);
    if (!target) {
      target = `T${targets.size + 1}`;
      targets.set(source.targetId, target);
      targetIds.set(target, source.targetId);
    }
    const id = `S${i + 1}`;
    sourceIds.set(id, source.id);
    return { ...source, id, targetId: target };
  });
  function references(refs) {
    return refs?.map(ref => ({ ...ref, sourceId: sourceIds.get(ref.sourceId) ?? '' }));
  }
  function restoreReferences(item) {
    return { ...item, evidence_references: references(item.evidence_references) };
  }
  function restore(result) {
    return { ...result,
      headline_target_id: targetIds.get(result.headline_target_id) ?? '',
      headline_evidence_references: references(result.headline_evidence_references),
      summary_target_id: targetIds.get(result.summary_target_id) ?? '',
      summary_evidence_references: references(result.summary_evidence_references),
      bullet_improvements: result.bullet_improvements?.map(bullet => ({ ...restoreReferences(bullet),
        target_id: targetIds.get(bullet.target_id) ?? '',
      })),
      project_improvements: result.project_improvements?.map(restoreReferences),
      position_name_suggestion: result.position_name_suggestion && restoreReferences(result.position_name_suggestion),
    };
  }
  return { sources: labelled, restore };
}
