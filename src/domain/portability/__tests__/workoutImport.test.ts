import { parseCsv } from '../csv';
import { parseExternalWorkoutCsv } from '../workoutImport';

describe('external workout CSV import', () => {
  it('reads RFC4180 quoted commas, escaped quotes, BOM and multiline fields', () => {
    expect(parseCsv('\uFEFFa,b\r\n"one, two","say ""go""\nnow"')).toEqual([
      ['a', 'b'],
      ['one, two', 'say "go"\nnow'],
    ]);
  });

  it('parses Hevy rows, converts pounds to kg and maps set metadata', () => {
    const csv = [
      'title,start_time,end_time,exercise_title,set_index,set_type,weight_lbs,reps,duration_seconds,rpe,exercise_notes',
      'Push,28 Mar 2025, 09:00,28 Mar 2025, 10:00,Bench Press (Barbell),0,warmup,135,10,,7.5,Prep',
    ].join('\n');

    // Timestamp commas must be quoted in an actual Hevy RFC4180 export.
    const fixed = csv.replace(
      '28 Mar 2025, 09:00,28 Mar 2025, 10:00',
      '"28 Mar 2025, 09:00","28 Mar 2025, 10:00"',
    );
    const result = parseExternalWorkoutCsv(fixed, {
      userId: 'user-1',
      strongWeightUnit: 'kg',
    });

    expect(result.source).toBe('hevy');
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0].exercises[0].exerciseId).toBe('barbell-bench-press');
    expect(result.sessions[0].exercises[0].sets[0]).toMatchObject({
      kind: 'warmup',
      loadKg: 61.235,
      reps: 10,
      rir: 2.5,
    });
  });

  it('parses Strong with the caller-selected unit and creates stable IDs', () => {
    const csv = [
      'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE',
      '2025-03-28 09:00:00,Upper,01:00,Bench Press (Barbell),1,135,8,0,0,,,8',
      '2025-03-28 09:00:00,Upper,01:00,Bench Press (Barbell),2,135,7,0,0,,,9',
    ].join('\n');
    const options = { userId: 'user-1', strongWeightUnit: 'lb' as const };
    const first = parseExternalWorkoutCsv(csv, options);
    const second = parseExternalWorkoutCsv(csv, options);

    expect(first.source).toBe('strong');
    expect(first.sessions[0].id).toBe(second.sessions[0].id);
    expect(first.sessions[0].finishedAt).not.toBe(first.sessions[0].startedAt);
    expect(first.sessions[0].exercises[0].sets[0].loadKg).toBe(61.235);
    expect(first.sessions[0].exercises[0].sets[1].rir).toBe(1);
  });

  it('reports unmapped exercises and imports the unambiguous rows', () => {
    const csv = [
      'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE',
      '2025-03-28 09:00:00,Upper,00:45,Bench Press (Barbell),1,100,8,0,0,,,8',
      '2025-03-28 09:00:00,Upper,00:45,My Mystery Lift,1,10,10,0,0,,,8',
    ].join('\n');
    const result = parseExternalWorkoutCsv(csv, {
      userId: 'user-1',
      strongWeightUnit: 'kg',
    });

    expect(result.importedRows).toBe(1);
    expect(result.unmappedExercises).toEqual([{ name: 'My Mystery Lift', rowCount: 1 }]);
    expect(result.sessions[0].exercises).toHaveLength(1);
  });
});
