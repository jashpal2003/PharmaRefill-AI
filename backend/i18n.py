"""
backend/i18n.py — English/Spanish support for the voice agent.

Inbound: Spanish utterances are normalised to the English keywords the FSM understands.
Outbound: agent replies are translated with pattern templates for every core prompt; anything
unmatched goes to the LLM gateway (when configured) and otherwise stays in English.
"""

import re
from typing import Callable, List, Optional, Tuple

import requests

from backend.config import ASSEMBLYAI_API_KEY, LLM_GATEWAY_URL, LLM_MODEL

# Cartesia sonic-2 language codes
CARTESIA_LANG = {"en": "en", "es": "es"}

INBOUND_ES = [
    (r"\bno puedo respirar\b", "can't breathe"),
    (r"\bdificultad para respirar\b", "trouble breathing"),
    (r"\bdolor de pecho\b", "chest pain"),
    (r"\breacci[oó]n al[eé]rgica\b", "allergic reaction"),
    (r"\bgarganta cerrada\b|\bse me cierra la garganta\b", "throat closing"),
    (r"\bhablar con (un|una|el|la)? ?(farmac[eé]utic[oa]|persona|humano)\b", "talk to pharmacist"),
    (r"\bresurtir\b|\bsurtir\b|\brellenar\b|\brenovar\b", "refill"),
    (r"\breceta\b|\bmedicamento\b|\bmedicina\b", "prescription"),
    (r"\best[aá] lista\b|\bestado\b", "status"),
    (r"\bcita\b|\bconsulta\b|\brevisi[oó]n de medicamentos\b", "appointment"),
    (r"\bsaldo\b|\bcu[aá]nto debo\b|\bfactura\b", "balance"),
    (r"\bpagar\b|\bcobrar\b", "pay"),
    (r"\bma[nñ]ana\b", "tomorrow"),
    (r"\bjueves\b", "thursday"),
    (r"\bviernes\b", "friday"),
    (r"\bhorario\b|\bhoras\b", "hours"),
    (r"\bdirecci[oó]n\b", "address"),
    (r"\bvacuna\b", "vaccine"),
    (r"\bs[ií]\b|\bclaro\b|\bde acuerdo\b|\best[aá] bien\b|\bconfirmo\b", "yes"),
    (r"\beso es todo\b|\bnada m[aá]s\b|\badi[oó]s\b", "that's all"),
    (r"\bmuy caro\b|\bcancelar\b", "too high"),
]


def normalize_inbound(text: str, lang: str) -> str:
    if lang != "es":
        return text
    out = text.lower()
    for pat, repl in INBOUND_ES:
        out = re.sub(pat, repl, out)
    return f"{out} {text}"  # keep original too, so names and dates still parse


def _es_summary(summary: str) -> str:
    return re.sub(r" plus (\d+) synchronized maintenance medications?", r" más \1 medicamento(s) sincronizado(s)", summary)


OUTBOUND_ES: List[Tuple[str, Callable[[re.Match], str]]] = [
    (r"^Thank you for calling (.+?)\. This call is recorded for clinical quality and accuracy\. I see you're calling from the number on file for (.+?)\. To verify your record, could you please confirm your date of birth, including the year\?$",
     lambda m: f"Gracias por llamar a {m[1]}. Esta llamada se graba por calidad clínica. Veo que llama desde el número registrado de {m[2]}. Para verificar su expediente, ¿podría confirmar su fecha de nacimiento completa, incluido el año?"),
    (r"^Thank you for calling (.+?)\. This call is recorded for clinical quality and accuracy\. Welcome! May I please have your full name and date of birth to look up your profile\?$",
     lambda m: f"Gracias por llamar a {m[1]}. Esta llamada se graba por calidad clínica. ¿Me podría dar su nombre completo y fecha de nacimiento para buscar su expediente?"),
    (r"^Thank you, (\w+)\. Your identity is verified\.(?: Are you calling today to refill your (\w+)\?)? How can I help you today\?$",
     lambda m: f"Gracias, {m[1]}. Su identidad está verificada." + (f" ¿Llama para resurtir su {m[2]}?" if m[2] else "") + " ¿En qué le puedo ayudar hoy?"),
    (r"^Found your record, (\w+)\. What prescription or pharmacy service can I assist you with today\?$",
     lambda m: f"Encontré su expediente, {m[1]}. ¿Con qué receta o servicio de farmacia le puedo ayudar hoy?"),
    (r"^Thanks, (\w+)\. And could you please state your full date of birth, including the year, for verification\?$",
     lambda m: f"Gracias, {m[1]}. ¿Podría decirme su fecha de nacimiento completa, incluido el año, para verificar?"),
    (r"^I have queued your (.+?)\. I also noticed that your (.+?) will run out in less than a week\. Would you like me to synchronize them so you can pick up all medications together this Friday\?$",
     lambda m: f"He puesto en cola su {m[1]}. También noté que su {m[2]} se acabará en menos de una semana. ¿Desea que los sincronice para recoger todos sus medicamentos juntos este viernes?"),
    (r"^Your estimated copay for (.+?) is (\$[\d.]+), based on the copay on file for your plan\. Would you like to confirm this order for Friday pickup\?$",
     lambda m: f"Su copago estimado para {_es_summary(m[1])} es de {m[2]}, según el copago registrado de su plan. ¿Desea confirmar este pedido para recogerlo el viernes?"),
    (r"^Perfect\. Will you be picking this up at our drive-thru window between 3:00 PM and 6:00 PM on Friday\?$",
     lambda m: "Perfecto. ¿Lo recogerá en nuestra ventanilla de autoservicio el viernes entre las 3:00 y las 6:00 de la tarde?"),
    (r"^You're all set, (\w+)!.*$",
     lambda m: f"¡Listo, {m[1]}! Sus recetas están en la cola de despacho y se empacarán juntas para el viernes por la tarde. Le envié un mensaje de texto de confirmación. ¿Hay algo más en lo que le pueda ayudar hoy?"),
    (r"^Under Title 21.*?for (.+?), as it is a Schedule (\w+) controlled substance\..*$",
     lambda m: f"Por ley federal y la política de la farmacia, no se permiten resurtidos automáticos de {m[1]}, ya que es una sustancia controlada de la Lista {m[2]}. Marqué su expediente para revisión y lo transfiero a nuestro farmacéutico de turno."),
    (r"^I hear that you are reporting acute clinical symptoms\..*$",
     lambda m: "Entiendo que tiene síntomas graves. Por su seguridad, detengo todas las solicitudes automáticas y lo comunico de inmediato con nuestro farmacéutico de emergencia. Si no puede respirar, cuelgue y llame al 911."),
    (r"^Please hold for just a moment while I transfer you.*$",
     lambda m: "Por favor espere un momento mientras lo transfiero a nuestro farmacéutico de turno. Ya le envié su expediente."),
    (r"^(.*?) Please repeat that or speak slowly\.$",
     lambda m: "No pude entender bien. Por favor repítalo o hable despacio."),
    (r"^I'm having a little difficulty.*$",
     lambda m: "Tengo dificultad para entenderle hoy. Para atenderle con precisión, lo transfiero con nuestro equipo de farmacia."),
    (r"^Your current outstanding prescription balance is (\$[\d.]+)\. We have your card ending in (\d+) on file\..*$",
     lambda m: f"Su saldo pendiente es de {m[1]}. Tenemos registrada su tarjeta que termina en {m[2]}. ¿Desea que procese el pago hoy?"),
    (r"^Thank you\. Your payment of (\$[\d.]+) has been processed successfully\. Your remaining account balance is (\$[\d.]+)\..*$",
     lambda m: f"Gracias. Su pago de {m[1]} fue procesado. Su saldo restante es de {m[2]}. ¿Algo más en lo que le pueda ayudar?"),
    (r"^I would be glad to schedule a clinical consultation with (.+?)\. We have appointments available (.+?) or (.+?)\. Which time works best for you\?$",
     lambda m: f"Con gusto le programo una consulta con {m[1]}. Tenemos citas disponibles {m[2]} o {m[3]}. ¿Qué horario le conviene?"),
    (r"^I have booked your clinical consultation for (.+?) with (.+?)\. We will text.*$",
     lambda m: f"Reservé su consulta para {m[1]} con {m[2]}. Le enviaremos un recordatorio por mensaje de texto. ¿Algo más en lo que le pueda ayudar?"),
    (r"^Your prescription for (.+?) has (\d+) refills remaining and is scheduled for refill on ([\d-]+)\. Your copay on file is (\$[\d.]+)\..*$",
     lambda m: f"Su receta de {m[1]} tiene {m[2]} resurtidos restantes y está programada para el {m[3]}. Su copago registrado es de {m[4]}. ¿Desea que envíe este resurtido?"),
    (r"^Is there anything else I can help you with today\?$",
     lambda m: "¿Hay algo más en lo que le pueda ayudar hoy?"),
    (r"^Thank you for calling\. Take care, goodbye!$",
     lambda m: "Gracias por llamar. Cuídese, ¡adiós!"),
    (r"^A pharmacist is joining the call now\..*$",
     lambda m: "Un farmacéutico se está uniendo a la llamada. Por favor permanezca en la línea."),
]


def _llm_translate(text: str, lang: str) -> Optional[str]:
    if not ASSEMBLYAI_API_KEY:
        return None
    try:
        resp = requests.post(
            LLM_GATEWAY_URL,
            headers={"authorization": ASSEMBLYAI_API_KEY, "content-type": "application/json"},
            json={"model": LLM_MODEL, "max_tokens": 400, "temperature": 0,
                  "messages": [{"role": "user", "content":
                                f"Translate this pharmacy phone-agent reply into natural, plain Spanish for a patient. "
                                f"Keep drug names, numbers and prices unchanged. Output only the translation.\n\n{text}"}]},
            timeout=6,
        )
        if resp.status_code == 200:
            return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception:
        pass
    return None


def localize_outbound(text: str, lang: str) -> str:
    if lang != "es" or not text:
        return text
    for pat, fn in OUTBOUND_ES:
        m = re.match(pat, text, flags=re.S)
        if m:
            return fn(m)
    return _llm_translate(text, lang) or text
