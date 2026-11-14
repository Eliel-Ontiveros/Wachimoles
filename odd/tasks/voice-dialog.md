# Voice: follow-up questions (slot filling) + check-in through the streak
Branch feat/voice-commands. Builds on odd/tasks/voice-all-actions.md (intents, prefill channels, S2 rule: health records are never saved silently).

## Specs
- S1 User (verbatim): "cuando haya preguntas abiertas o cambios que llenar, me gustaría que el modelo sea capaz de preguntártelo, hasta que se pueda llegar a un estado donde se pueda tener algo completo a lo cual dirigirte."
- S2 User (verbatim): "ejemplo además de las molestias podría ser por ejemplo quiero registrar mi chequeo diario que te lleve a la función de la racha y pues ahí solo te muestra cómo hace check-in"
- S3 Molestia (register-observation) is complete only with: zone with side, painIntensity 0-10, swelling yes/no, functionalLimitation yes/no; notes optional (asked once, "no" skips). Missing slots are asked one at a time by voice (TTS), the mic re-opens automatically to hear the answer, the question shows as the big text above the orb. When complete: warp to the zone and open the observation form fully prefilled (screenshot form: Intensidad del dolor, ¿Hinchazón o inflamación?, ¿Limitación funcional?, Observaciones); the user taps "Guardar registro".
- S4 Answers accept digits and Spanish/English number words ("siete", "seven"), pain words (leve 3, moderado 5, fuerte 8, muy fuerte/insoportable 10), yes/no ("sí", "claro", "no", "nada"), sides, free text for notes; "cancelar" ends the dialog; an unparseable answer repeats the question once with a hint; after 2 failures the dialog stops gracefully.
- S5 A sided zone without a side asks "¿derecho o izquierdo?" (instead of failing) and continues.
- S6 Daily health questionnaire (fill-health-check) asks for the missing fields (glucosa, presión, temperatura, sueño, ánimo, síntomas) one by one; "omitir"/"no sé"/"skip" skips a field; then warps to the questionnaire prefilled (user saves).
- S7 "quiero registrar mi chequeo diario" / "hacer check-in" / start-checkin → warp to Misiones (/missions, the streak), then visibly perform the check-in there (highlight the check-in control, then call doDailyCheckIn ~1 s later) and announce the new streak. If already checked in today, say so and show the streak. The health questionnaire stays reachable with "cuestionario de salud".
- S8 LLM clarifications are conversational: when DeepSeek answers {type:"unknown", message}, the app speaks the message, listens again, and sends the conversation (last turns) so the model can complete the action. Backend `POST /voice/interpret` accepts optional `history` [{role:'user'|'assistant', content ≤300}] max 6 items, validated.

## Tasks
- T1 S8 backend history in DTO/service/prompt — worker — done b3e05d2
- T2 S1-S8 app dialog engine (pure, tested), provider loop (TTS → auto listen), UI question text, missions check-in channel, client history — worker — done

## Log
- L1 Screenshot of the observation form + S1/S2 request.
