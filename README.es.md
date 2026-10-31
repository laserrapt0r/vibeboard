# vibeboard

[English](README.md) · [Deutsch](README.de.md) · **Español** · [Français](README.fr.md)

Una pizarra colaborativa en línea de alojamiento propio. Varias personas trabajan a la vez sobre un lienzo infinito:
con notas adhesivas, formas, conectores, mapas mentales, comentarios, votaciones y más de 75 plantillas para talleres,
retrospectivas, trabajo estratégico, desarrollo de software, gestión de proyectos y gestión de servicios de TI. Para los
equipos de desarrollo hay bloques de código, diagramas a partir de texto (sintaxis Mermaid), rondas de estimación y una
importación de tarjetas desde exportaciones de Jira o Excel. Para el trabajo en equipo hay notificaciones de @menciones,
un historial de actividad, permisos de moderación, equipos y carpetas, enlaces de invitado con caducidad y recorridos
grabados. Además hay cuentas de usuario con confirmación por correo electrónico e inicio de sesión en dos pasos
opcional, permisos por tablero y una interfaz de administración. Los datos se guardan en PostgreSQL.

- Funciona por completo en tu propio servidor: sin CDN, sin seguimiento, sin dependencia obligatoria de servicios externos.
- Los archivos subidos se analizan con ClamAV en busca de software malicioso.
- Actualizaciones automáticas con copia de seguridad: las versiones nuevas actualizan la base de datos por sí mismas al arrancar.
- Todas las funciones están documentadas como requisitos: [docs/anforderungen](docs/anforderungen/README.md) (los documentos de requisitos están en alemán).
- Frontend en JavaScript y SVG puros, sin paso de compilación.
- Backend en Node.js con pocas dependencias (`pg`, `nodemailer`, `uqr`, `pdfjs-dist`, `ldapts`, `@node-saml/node-saml`, opcionalmente `kerberos`).
- Interfaz en inglés, alemán, español y francés: el idioma sigue al navegador y, por defecto, es el inglés.

![Colaboración en tiempo real: punteros del ratón con nombres, selección de otra persona y chat del cursor](docs/screenshots/zusammenarbeit.png)

---

## Capturas de pantalla

| | |
|---|---|
| ![Resumen de tableros con «Mis tareas»](docs/screenshots/uebersicht.png) | ![Planificación del sprint con panel de tareas y ronda de estimación](docs/screenshots/sprint-schaetzrunde.png) |
| **Resumen:** tableros propios y compartidos, «Mis tareas» de todos los tableros | **Planificación del sprint:** tarjetas con prioridad y story points, panel de tareas, ronda de estimación con tarjetas ocultas |
| ![Diagrama de arquitectura con conector curvo y puntos de quiebre](docs/screenshots/architektur-verbinder.png) | ![Diálogo «Diagrama a partir de texto» con vista previa en vivo](docs/screenshots/diagramm-aus-text.png) |
| **Conectores:** anclar libremente, curvar, puntos de quiebre, extremos de línea | **Diagrama a partir de texto:** la sintaxis Mermaid se convierte en formas editables |
| ![Diseño de API con tabla y bloque de código](docs/screenshots/api-design-code.png) | ![Plantilla Postmortem de incidente](docs/screenshots/incident-postmortem.png) |
| **Desarrollo de software:** tablas y bloques de código con resaltado de sintaxis | **Gestión de servicios de TI:** p. ej., postmortem de incidente |
| ![Galería de plantillas, categoría Gestión de servicios de TI](docs/screenshots/vorlagen.png) | ![Administración con métricas del sistema](docs/screenshots/administration.png) |
| **Más de 75 plantillas** en 12 categorías | **Administración:** resumen con CPU, memoria, espacio en disco y más |

Todo el contenido de las capturas de pantalla son datos de ejemplo.

---

## Contenido

- [Capturas de pantalla](#capturas-de-pantalla)
- [Funciones](#funciones)
- [Plantillas](#plantillas)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Cuentas e inicio de sesión](#cuentas-e-inicio-de-sesión)
- [Permisos en los tableros](#permisos-en-los-tableros)
- [Administración](#administración)
- [Accesibilidad](#accesibilidad)
- [Idiomas](#idiomas)
- [Protección antivirus para las cargas](#protección-antivirus-para-las-cargas)
- [Versiones y actualizaciones](#versiones-y-actualizaciones)
- [Registro](#registro)
- [Seguridad](#seguridad)
- [Almacenamiento de datos y privacidad](#almacenamiento-de-datos-y-privacidad)
- [Arquitectura](#arquitectura)
- [Licencia](#licencia)

---

## Funciones

### Lienzo y navegación
- Lienzo infinito con zoom del 1 % al 800 %
- Desplazamiento con la barra espaciadora, la herramienta mano, el botón central del ratón o el trackpad; zoom de pellizco en dispositivos táctiles
- Minimapa, «Mostrar todo», niveles de zoom fijos
- Cuadrícula de puntos, ajuste a la cuadrícula, guías inteligentes al mover
- Tema claro y oscuro; la vista se recuerda por tablero

### Contenido
| Elemento | Posibilidades |
|---------|---------------|
| **Notas adhesivas** | 16 colores, tamaño de letra automático, opcionalmente con el nombre de la persona autora |
| **Texto** | Tamaño de letra, color, negrita, cursiva, alineación, fondo |
| **Formas** | Más de 60 formas en siete grupos: formas básicas, diagrama de flujo (documento, varios documentos, entrada manual, pantalla, etc.), UML (clase con compartimentos, actor, paquete, componente, nodo, inicio/fin, bifurcación, señales), BPMN (eventos, pasarelas), red y centro de datos (router, switch, firewall, balanceador de carga, punto de acceso, internet, servidor, armario de servidores, sistema de almacenamiento, PC, smartphone), software y TI, plataforma de contenedores (pod, deployment, service, ingress, node, ConfigMap, secret, volume): todo de dibujo propio, con relleno, borde, tipo de trazo y texto |
| **Conectores** | rectos, en ángulo o curvos; se anclan en cualquier punto del contorno (o automáticamente); al arrastrar la línea se curva, se pueden insertar, mover y quitar puntos de quiebre; etiqueta movible; 9 extremos de línea (flecha, rombo, círculo, pata de gallo, etc.), tipo de trazo |
| **Conexión rápida** | Haz clic en los puntos de un elemento seleccionado, o arrástralos, para crear elementos conectados |
| **Mano alzada** | Lápiz, resaltador, borrador |
| **Marcos** | Áreas o diapositivas con formatos (16:9, 4:3, A4, cuadrado, smartphone); el contenido se mueve junto con el marco |
| **Tarjetas** | Tareas con descripción, responsable, fecha de vencimiento, estado, prioridad, story points, número de ticket, etiquetas y color |
| **Bloques de código** | Código fuente con resaltado de sintaxis para 13 lenguajes, números de línea, esquema claro u oscuro, botón de copiar |
| **Diagrama a partir de texto** | Introduce diagramas de flujo y de secuencia en sintaxis Mermaid, con vista previa en vivo; el resultado son formas y conectores normales y editables |
| **Tablas** | Seleccionar celdas y rangos; por celda negrita, cursiva, subrayado, tachado, alineación, tamaño de letra, color de texto y de celda; insertar y eliminar filas/columnas en cualquier posición; arrastrar anchos de columna y alturas de fila; manejo con el teclado como en una hoja de cálculo |
| **Mapas mentales** | Selecciona un nodo y pulsa **Tab** para un nodo hijo y **Enter** para un nodo hermano |
| **Imágenes** | mediante carga, arrastrar y soltar o desde el portapapeles; las imágenes grandes se reducen automáticamente |
| **Stickers** | Emojis como elementos que se colocan libremente |
| **Enlaces** | Adjunta una URL a los elementos; un icono de enlace la abre |
| **Comentarios** | Hilos en cualquier lugar, @menciones con lista de sugerencias y notificación, estado «Hecho», asignar como tarea (con vencimiento), resumen de comentarios con el filtro «Asignado a mí» |

Al pegar texto de varias líneas en el tablero se crea automáticamente una nota adhesiva por línea.

### Edición
- Selección múltiple con un marco de selección o con clic mientras mantienes Mayús
- **Cambiar el tamaño:**
  - Los tiradores laterales cambian solo el ancho o el alto, también en elementos planos como las barras de Gantt.
  - Mayús mantiene la proporción, Alt cambia el tamaño desde el centro.
  - El tamaño se muestra mientras arrastras.
- **Ajuste magnético:**
  - a bordes, centros y líneas de tabla de otros elementos
  - a igual ancho/alto y a iguales distancias (con marcas de distancia)
  - a la cuadrícula (10–50 px a elegir)
  - Mayús mueve solo en horizontal o en vertical.
- **Valores exactos:** introduce X, Y, ancho y alto, también para varios elementos a la vez.
- **Selección múltiple:**
  - Alinear (izquierda, centro, derecha, arriba, abajo), distribuir uniformemente, colocar uno tras otro sin huecos o con
    separación fija, ordenar en cuadrícula.
  - Mismo ancho, alto o tamaño; copiar y aplicar tamaño; alinear a la cuadrícula.
- **Duplicado inteligente:** Ctrl+D repite el último desplazamiento utilizado.
- Trabajo rápido: Tab al escribir añade la siguiente nota o forma al lado, un doble clic mantiene activa una herramienta y el menú de formas muestra las usadas recientemente. En las plantillas, las etiquetas se editan directamente y los fondos siguen bloqueados; las plantillas de retro y brainstorming ofrecen su flujo o temporizador. Arrastrar una tarjeta a una columna Kanban fija su estado, y un marco se puede eliminar con su contenido.
- Agrupar notas adhesivas por color
- Agrupar, bloquear, capas (primer plano y fondo), duplicar (también arrastrando con Alt); un segundo clic en un grupo
  selecciona un solo elemento para editarlo
- Copiar y pegar, también entre tableros
- Deshacer y rehacer, menú contextual, búsqueda (Ctrl+F)
- Numerosos atajos de teclado (resumen con `?`)

### Colaboración en tiempo real
- Los cambios aparecen al instante para todos los participantes
- **Cursores en vivo con nombres:**
  - La selección de las demás personas se marca con color y lleva su nombre; quien está escribiendo en ese momento se
    muestra como «✎ Nombre está escribiendo …». Mover, cambiar el tamaño y un diálogo de tarjeta abierto se muestran igual; no se bloquea nada.
  - Las personas fuera de tu vista aparecen como una flecha en el borde de la pantalla; un clic te lleva hasta ellas.
  - Las personas ausentes (otra pestaña) se muestran en gris; las vistas de todos aparecen como marcos en el minimapa.
  - Los punteros del ratón de otras personas se pueden ocultar en los ajustes.
- **Chat del cursor:** Con `/` muestras un mensaje breve junto a tu propio puntero del ratón, sin crear un comentario
- Lista de participantes con «Seguir» (seguir la vista de una persona), «Traer a todos a mi vista» y «Todos me siguen»
- **Modo privado:** Al principio todos reúnen ideas de forma oculta: el contenido nuevo solo lo ve quien lo creó, hasta
  que se revela en conjunto. Antes de eso el servidor no entrega el contenido a nadie más.
- Reacciones voladoras (emojis) y puntero láser
- Reconexión automática; los cambios no enviados no se pierden
- **Estado de guardado** en la cabecera: «Guardado» solo cuando todos tus cambios han llegado a la base de datos; si no,
  «Guardando …», «Sin conexión: n pendientes» o «Guardado retrasado». Mientras haya cambios atascados sin conexión,
  el navegador pregunta antes de cerrar la página.
- **Indicador de carga:** Al abrir un tablero aparece, tras un breve tiempo, un indicador de carga y, pasados unos
  segundos, con una indicación sobre un posible proxy. La página de inicio muestra marcadores de posición y, en las
  solicitudes más largas, una barra de progreso.
- **Sin conflictos al editar en grupo:** Si varias personas cambian el mismo elemento en el mismo momento, todas terminan con el mismo resultado. Los cambios en propiedades distintas (por ejemplo, color y texto) se conservan; en la misma propiedad gana el último cambio que llega al servidor.
- **Funciona también en redes restrictivas:** No se necesitan WebSockets. La transmisión en tiempo real va por
  Server-Sent Events (HTTP normal). Si también estos se bloquean o un proxy los almacena en búfer, vibeboard cambia
  a long polling como máximo a los cuatro segundos y lo recuerda en el navegador durante siete días: el siguiente
  tablero se abre entonces sin espera. Con `?transport=sse` o `?transport=poll` se puede forzar el método.

  *¿Por qué puede tardar detrás de un proxy directo?* Server-Sent Events es una respuesta HTTP que nunca termina. Algunos
  proxies (y antivirus en proxies) retienen las respuestas hasta que están completas o se llena un búfer; en el
  tablero entonces no llega nada al principio. Por eso vibeboard envía al comienzo 2 KB de caracteres de relleno
  (suficiente para muchos proxies) y detecta un flujo bloqueado porque falta el mensaje inicial.

### Trabajo en equipo
- **Notificaciones:** Campana en la página de inicio y en el tablero para @menciones, respuestas y comentarios
  asignados: en vivo y, si se desea, por correo electrónico (como máximo uno por tablero cada diez minutos, se puede
  desactivar en el perfil).
- **Historial de actividad:** quién ha creado, cambiado, eliminado o comentado qué y cuándo, resumido y con salto al
  elemento. Al abrir, un aviso muestra los cambios de otras personas desde la última visita y los marca en el lienzo.
- **Rol «Comentar»** entre ver y editar: para áreas funcionales, clientes o revisiones.
- **Equipos y carpetas:** Comparte tableros con un equipo entero (editar, comentar o ver), carpetas personales y
  carpetas en el equipo. Los miembros nuevos se **invitan** por dirección de correo electrónico y deben aceptar la
  invitación (página de inicio o campana); los administradores del equipo ven las invitaciones pendientes y pueden
  retirarlas.
- **Invitación sin cuenta:** Los tableros y los equipos también se pueden compartir con direcciones que aún no están
  registradas. Tras una confirmación se envía un correo de invitación; después de registrarse mediante el enlace, el
  tablero queda compartido o la persona entra en el equipo.
- **Enlaces de invitado:** Las personas sin cuenta ven o comentan un único tablero: con caducidad, bloqueables en
  cualquier momento y desactivados por defecto.
- **Grabar recorridos:** Vista, puntero del ratón y puntero láser, con sonido si se desea; otras personas reproducen el
  recorrido y pueden navegar por su cuenta mientras tanto.
- **Reacciones:** Emojis directamente en notas adhesivas, tarjetas y demás, con número y nombres, también para lectores
  (clic derecho).
- **Etiquetas y filtros:** Etiqueta notas adhesivas, tarjetas y formas; el filtro atenúa todo lo demás (por etiqueta,
  color, persona, reacciones, acciones), solo en tu propia vista.
- **Archivos adjuntos:** Coloca en el tablero PDF, Word, Excel, PowerPoint, OpenDocument, texto, CSV y JSON; los PDF con
  vista previa de la primera página y visor (pdf.js), todo con análisis antivirus y como descarga.
- **Conexión con chats (webhooks):** Notificaciones a tu propio chat (Microsoft Teams, Slack, Matrix o JSON), canales
  de equipo para tableros de equipo nuevos y resúmenes de retros. Desactivado por defecto, con protección contra
  llamadas a la red interna.

### Moderación
- **Permisos de moderación:** Bloquear la edición para los participantes, reservar el temporizador, la votación, la
  ronda de estimación y el modo privado a los moderadores, bloquear elementos individuales (p. ej., fondos de plantillas)
  para los participantes. Se pueden añadir más moderadores desde el menú del avatar. El servidor aplica todos los
  bloqueos.
- **Temporizador** para todos los participantes, con pausa, ampliación y tono de aviso
- **Votaciones** con un número de votos por persona ajustable; los votos permanecen ocultos hasta el final y después hay una lista de resultados
- **Ronda de estimación** con tarjetas ocultas para una tarjeta: baraja de Fibonacci, de tallas de camiseta o de horas;
  los valores permanecen ocultos hasta que se revelan. Después aparecen el promedio, la mediana y el rango, y el
  resultado se puede adoptar como story points.
- **Modo de presentación**: los marcos se convierten en diapositivas (pantalla completa, teclas de flecha y espacio, entorno oculto)
- **Áreas ocultas:** Los moderadores tapan un marco; los participantes solo ven una cubierta hasta que se revela.
  Antes de eso el servidor no entrega el contenido.

### Retrospectivas
- **Desarrollo guiado** (botón 🔁): Check-in → Repaso → Recopilar → Revelar → Agrupar → Votar → Debatir →
  Acciones → Cierre. En cada paso vibeboard configura las herramientas adecuadas (recopilación oculta y, si se desea,
  anónima, temporizador, votación sobre temas, debate, encuestas).
- **Grupos de temas:** Selecciona aportaciones → «Crear grupo de temas»; después se vota sobre temas.
- **Modo de debate:** Los temas en el orden de los votos, el actual aparece resaltado para todos, temporizador por tema
  y la pregunta «¿Seguimos debatiendo? 👍 ✋ 👎».
- **Aportaciones anónimas:** También después de revelar, sin nombres; no se guarda ninguno.
- **Encuestas rápidas:** Termómetro de ánimo, Fist of Five, ROTI, chequeo de salud del equipo, pregunta propia:
  anónimas, con evolución a lo largo de la serie de retros.
- **Acciones con seguimiento:** Aportación → «Anotar como acción» (persona, vencimiento); aparece en «Mis tareas».
  «Crear siguiente retro» conserva la estructura; allí el repaso muestra las acciones abiertas de la última retro para
  marcarlas o transferirlas.
- **Resumen** en Markdown, PDF, por correo electrónico a las personas implicadas o al canal del equipo.
- **Ruleta y orden de intervención**: todos ven el mismo resultado.

### Trabajo de proyecto
- **Panel de tareas** por tablero:
  - Todas las tarjetas como lista, agrupadas por estado, con sumas de story points.
  - Filtros «Abierto», «Asignado a mí», «Vencida»; un clic salta a la tarjeta.
- **Mis tareas** en la página de inicio: todas las tarjetas que me están asignadas en todos mis tableros, ordenadas por vencimiento.
- **Historial de versiones:**
  - Guardar versiones, versiones automáticas cada 30 minutos durante la edición.
  - Restaurar versiones anteriores (la actual se guarda antes) o abrirlas como copia.
- **Importar tarjetas** desde CSV, Excel, Jira o Azure DevOps:
  - Se reconocen columnas como Summary, Assignee, Status, Due Date, Story Points, Priority, Labels.
  - Opcionalmente las tarjetas se ordenan como columnas kanban según el estado.
- **Enlaces directos** a elementos individuales: `/board/<id>#el=<elementId>`

### Revisión y tareas
- **Revisar documentos en el tablero:** Coloca todas las páginas de un PDF como marco y comenta o dibuja sobre ellas. Los archivos de Office funcionan con el conversor opcional.
- **Aprobaciones:** Presenta marcos y archivos a personas revisoras. Basta con el rol de comentar, los cambios invalidan una aprobación y el estado se muestra en el elemento.
- **Kanban y cronología:** Otras vistas de las mismas tarjetas, también sin ratón.
- **Jira y Azure DevOps:** Tarjetas y tickets sincronizados en ambas direcciones.
- **Diseño automático y carriles:** Ordena elementos conectados o mapas mentales con un clic.
- **Gráficos a partir de tablas:** Barras, líneas y circular, que siguen a la tabla.
- **Imágenes y bocetos:** Recorte de imágenes, presión del lápiz y bocetos convertidos en formas.

Más información: [docs/integrations.md](docs/integrations.md) (en inglés).

### Exportación e importación
- PNG (todo el tablero o la selección) y SVG
- PDF con un marco por página (mediante el cuadro de impresión del navegador)
- JSON como copia de seguridad; importación al tablero o como tablero nuevo
- Tarjetas desde CSV/tablas, diagramas a partir de texto (véase arriba)

### Resumen
- Navegación a la izquierda: «+ Tablero nuevo», Inicio, Mis tareas, todos los tableros / propios / compartidos,
  carpetas propias, equipos (con carpetas como filtro); a la derecha solo aparece la vista elegida
- Inicio: barra de plantillas plegable, aviso de tareas por vencer, tableros editados recientemente
- Tableros propios y compartidos con imágenes en miniatura
- Búsqueda, ordenación, compartir, renombrar, duplicar, eliminar, salir de un tablero
- **Papelera:** Los tableros eliminados se pueden restaurar durante 30 días (ajustable); después se eliminan definitivamente.
- Tablero nuevo directamente desde una plantilla, también desde **plantillas propias** (guardar un tablero o una
  selección como plantilla personal o de equipo)
- **Aplicación instalable (PWA):** se puede usar en su propia ventana desde el navegador con «Instalar app» (menú de la cuenta)
- «Mis tareas» de todos los tableros (tarjetas y comentarios asignados)
- Campana con notificaciones

---

## Plantillas

| Categoría | Plantillas |
|-----------|----------|
| Brainstorming | Brainstorming, Mapa mental, Seis perspectivas, Crazy 8s, Pros y contras |
| Reuniones y retros | Start · Stop · Continue, Mad · Sad · Glad, 4L, velero, estrella de mar, DAKI, retro de línea de tiempo, globo aerostático, coche de carreras, Ronda de temas abiertos, Radar del equipo, Daily Stand-up, Check-in / Icebreaker |
| Ágil y proyectos | Kanban, Matriz de Eisenhower, Matriz impacto/esfuerzo, Project Canvas, Roadmap de producto, Línea de tiempo, Diagrama de Gantt, User Story Map, Planificador semanal |
| Estrategia | Análisis FODA, Mapa de stakeholders, Business Model Canvas¹, Lean Canvas¹, Planificación de OKR, Matriz de decisión |
| Diseño y UX | Customer Journey Map, Empathy Map, User Persona, Moodboard, Wireframe |
| Desarrollo de software | Planificación del sprint, Kanban de desarrollo con límites WIP, Definition of Ready y Done, Arquitectura (contexto C4), Diagrama ER, Event Storming, Triaje de bugs, Matriz de deuda técnica, Planificación de releases, Diseño de API, Decisión de arquitectura (ADR) |
| UML | Diagrama de clases, Diagrama de casos de uso, Diagrama de actividades, Diagrama de estados, Diagrama de componentes, Diagrama de despliegue, Diagrama de secuencia |
| Gestión de proyectos | Kick-off del proyecto, Matriz de riesgos, Registro RAID, Estado del proyecto, Plan de hitos, Matriz RACI, Planificación entre equipos, Lecciones aprendidas |
| Gestión de servicios de TI | Postmortem de incidente, Centro de situación de incidente mayor, Análisis de problemas (es / no es), Solicitud de cambio y CAB, Service Blueprint, SIPOC, Análisis del flujo de valor, Catálogo de servicios, Traspaso de guardia, Runbook, Revisión de SLA / servicio, Modelo de procesos (BPMN): incidencia |
| Infraestructura de TI | Plano de red, Ocupación de racks, Plataforma de contenedores (clúster) |
| Diagramas | Diagrama de flujo, Organigrama, Ishikawa (espina de pescado), Método de los 5 porqués |

¹ Adaptación de una obra bajo CC BY-SA 3.0, véase [Licencia](#licencia).

---

## Instalación

### Con Docker (recomendado)

```bash
git clone https://github.com/laserrapt0r/vibeboard.git
cd vibeboard
cp .env.example .env            # poner POSTGRES_PASSWORD con una contraseña larga y aleatoria
docker compose up -d --build    # inicia PostgreSQL, ClamAV y vibeboard
```

Después, vibeboard está disponible en http://localhost:3000. El puerto lo define `PORT` en el `.env`.

Así se continúa:
1. En el primer acceso se abre el registro. **La primera cuenta se convierte automáticamente en administrador.**
2. En **Administración → Servidor de correo** introduce el acceso SMTP. Solo después podrán registrarse otras personas,
   porque cada registro necesita una confirmación por correo electrónico.
3. En **Administración → General** introduce la dirección pública si se accede a vibeboard mediante un nombre de dominio.
4. Recomendado: configura el inicio de sesión en dos pasos en el perfil, en «Seguridad y dispositivos».

Como alternativa, `ADMIN_EMAIL`, `ADMIN_PASSWORD` y, opcionalmente, `ADMIN_NAME` en el `.env` crean el administrador al
arrancar (se inicia sesión con la dirección de correo electrónico).

ClamAV necesita unos 1,5 GB de memoria. En el primer arranque descarga las firmas de virus durante unos minutos;
hasta entonces las cargas se rechazan con un aviso.

Comandos útiles:

```bash
docker compose logs -f app                                        # registro
docker compose down                                               # detener (los datos se conservan)
docker compose exec db pg_dump -U vibeboard vibeboard > backup.sql  # copia de seguridad de la base de datos
docker compose --profile mailtest up -d                           # además, servidor de correo de prueba (Mailpit)
```

Con el perfil `mailtest` introduces en la administración el servidor SMTP `mailpit`, el puerto `1025` y el cifrado
«ninguno». Todos los correos aparecen entonces en http://localhost:8025.

### Sin Docker

Requisitos: Node.js ≥ 20, PostgreSQL ≥ 13, ClamAV (`clamd`) para las cargas y `pg_dump` para las copias de seguridad previas a las actualizaciones.

```bash
npm ci
DATABASE_URL=postgres://benutzer:kennwort@localhost:5432/vibeboard \
CLAMAV_HOST=127.0.0.1 BACKUP_DIR=/var/backups/vibeboard node server.js
```

Las tablas se crean y migran automáticamente al arrancar.

---

### En Kubernetes

Hay un [chart de Helm](deploy/helm/README.md) y manifiestos en [deploy/kubernetes](deploy/kubernetes/README.md). La aplicación debe ejecutarse con exactamente una réplica.

## Configuración

Variables de entorno (con Docker, en el `.env`):

| Variable | Valor por defecto | Significado |
|----------|----------|-----------|
| `PORT` | `3000` | Puerto HTTP |
| `HOST` | `0.0.0.0` | Dirección de enlace |
| `POSTGRES_PASSWORD` | – (obligatoria) | Contraseña de la base de datos en la configuración con Docker |
| `POSTGRES_DB`, `POSTGRES_USER` | `vibeboard` | Nombre y usuario de la base de datos en la configuración con Docker |
| `DATABASE_URL` | `postgres://vibeboard:vibeboard@localhost:5432/vibeboard` | Conexión a la base de datos sin Docker (alternativamente `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGPORT`) |
| `PUBLIC_URL` | – | Dirección pública para los enlaces de los correos, p. ej., `https://board.example.de` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | – | Crea este administrador en la configuración inicial, solo si aún no hay ningún administrador activo ni ninguna cuenta con esa dirección (`ADMIN_USERNAME` se sigue aceptando como nombre) |
| `TRUST_PROXY` | `0` | Proxy inverso delante: `1` (un proxy), `2` … (varios en serie) o una lista de direcciones/redes de proxy, p. ej., `127.0.0.1, 172.16.0.0/12`. Entonces evalúa `X-Forwarded-For` y `X-Forwarded-Proto`; véase «Direcciones IP reales» |
| `CLAMAV_HOST`, `CLAMAV_PORT` | `clamav`, `3310` (Docker) | Servicio clamd para el análisis antivirus; vacío = sin analizador |
| `BACKUP_DIR` | `/backups` (Docker) | Directorio para las copias de seguridad previas a las actualizaciones de la base de datos; vacío = sin copia |
| `BACKUP_KEEP` | `10` | Número de copias de seguridad que se conservan |
| `BACKUP_BEFORE_UPGRADE` | `1` | `0` omite la copia de seguridad (no recomendado) |
| `ALLOW_DOWNGRADE` | `0` | `1` permite arrancar una versión anterior sobre una base de datos más reciente (no recomendado) |
| `LOG_LEVEL` | `info` | Nivel de registro: `trace`, `debug`, `info`, `warn`, `error`, `fatal`, `silent`; se puede cambiar en tiempo de ejecución en la administración |
| `LOG_FORMAT` | `text` | `text` (legible) o `json` (una línea JSON por entrada, p. ej., para Loki, Elasticsearch, Graylog) |
| `DATA_DIR` | `./data` | Carpeta con tableros JSON de una versión anterior basada en archivos, para una importación única |

Todos los demás ajustes los haces en la administración.

---

## Cuentas e inicio de sesión

- **Inicio de sesión con la dirección de correo electrónico.** El nombre es solo un nombre para mostrar: puede contener
  espacios, no tiene que ser único y se puede cambiar en cualquier momento en el perfil. Las cuentas antiguas sin
  dirección de correo electrónico pueden iniciar sesión provisionalmente con su nombre (solo si es único) y en la
  página de inicio se les pide que añadan una dirección.
- **Registro** con nombre, dirección de correo electrónico y contraseña.
  - La cuenta solo se activa cuando se ha abierto el **enlace de confirmación** del correo (válido durante 48 horas).
  - El correo de confirmación se puede volver a solicitar en la página de inicio de sesión.
  - Las cuentas que nunca se confirmaron se eliminan automáticamente a los 14 días.
- **Las direcciones de correo desechables** están bloqueadas: una lista con unos 10 000 proveedores conocidos,
  subdominios incluidos. Además, el administrador puede bloquear dominios propios o permitir solo determinados
  dominios, p. ej., el dominio de la empresa.
- **Modo de registro:**
  - *abierto*: Tras la confirmación por correo electrónico la cuenta está activa.
  - *con aprobación*: Tras la confirmación, un administrador activa la cuenta. Se informa a los administradores por correo electrónico.
  - *cerrado*: Solo los administradores crean cuentas o invitan por correo electrónico.
- **Reglas de contraseña** según NIST SP 800-63B:
  - Longitud mínima de 12 caracteres (ajustable)
  - Se rechazan las 10 000 contraseñas más frecuentes, palabras conocidas con cifras añadidas, secuencias de teclado,
    repeticiones y contraseñas que contengan el nombre o la dirección de correo electrónico.
  - Opcionalmente, además, la comparación con «Have I Been Pwned» (k-anonimato).
  - Un indicador de seguridad ayuda a elegir. A propósito no se exigen caracteres especiales.
- **Inicio de sesión en dos pasos (TOTP):**
  - Configuración mediante código QR con cualquier aplicación de autenticación habitual
  - 10 códigos de recuperación para emergencias
  - Obligatorio para los administradores si se desea
- **Contraseña olvidada** mediante un enlace por correo electrónico (válido durante una hora).
- **Perfil:**
  - Nombre para mostrar y color
  - Dirección de correo electrónico; una dirección nueva solo se adopta tras la confirmación y la antigua recibe un aviso
  - Cambiar la contraseña; en ese momento se cierra la sesión en los demás dispositivos
- **Seguridad y dispositivos:** Resumen de todos los dispositivos con sesión iniciada y su última actividad. Se puede cerrar
  la sesión de uno solo o de todos los demás dispositivos.
- **Notificaciones** por correo electrónico ante cambios relevantes para la seguridad: contraseña cambiada, dirección de
  correo electrónico cambiada, inicio de sesión en dos pasos activado o desactivado, intento de registro con una
  dirección ya utilizada.

### Inicio de sesión externo

Además de las cuentas locales, vibeboard puede usar **Keycloak**, **SAML**, **LDAP/Active Directory** e **inicio de sesión único con Kerberos**, y las cuentas pueden gestionarse mediante **SCIM**. Todo es opcional y se configura en *Administración → Inicio de sesión*; LDAP viene predefinido para Active Directory. Pueden estar activos varios métodos a la vez, y los administradores locales conservan siempre un acceso de emergencia. Configuración: [docs/authentication.md](docs/authentication.md) (en inglés).

## Permisos en los tableros

- Los tableros pertenecen a la persona que los creó. El propietario puede
  - invitar a personas como *editores*, *comentaristas* o *lectores*, opcionalmente con un correo de invitación. Se
    invita mediante la **dirección de correo electrónico exacta** o desde la lista de personas con las que se está en
    un equipo. A propósito no hay búsqueda entre todas las cuentas: así nadie puede consultar los usuarios de la
    instalación. Si no existe ninguna cuenta para la dirección, vibeboard ofrece, tras una confirmación, un correo de
    invitación (válido durante 30 días; solo si el registro está abierto y hay un servidor de correo configurado).
  - compartir el enlace con todos los usuarios con sesión iniciada para *ver*, *comentar* o *editar*,
  - asignar el tablero a un **equipo**: todos los miembros reciben entonces el rol elegido,
  - crear **enlaces de invitado** para personas sin cuenta (solo si un administrador ha activado el acceso de invitados),
  - gestionar miembros, renombrar el tablero y eliminarlo.
- Los **lectores** ven el tablero en vivo y pueden votar, estimar, enviar reacciones y usar el chat del cursor y el
  puntero láser. El historial de versiones solo lo ven quienes editan.
- Los **comentaristas** pueden además comentar, asignar y resolver comentarios, y grabar recorridos.
- Si un rol procede de varias fuentes (pertenencia, equipo, enlace), cuenta el más alto. Los cambios de permisos surten
  efecto de inmediato.
- Los **invitados** ven exclusivamente el tablero de su enlace: ni página de inicio, ni otros tableros, ni funciones
  de perfil o de equipo. Cuando el enlace caduca o se bloquea, se eliminan sus accesos; sus aportaciones se
  conservan con su nombre.
- Los **administradores** tienen acceso a todos los tableros.

## Administración

En `/admin`, solo para administradores:

- **Resumen:**
  - Usuarios, proporción con inicio de sesión en dos pasos, cuentas sin confirmar
  - inicios de sesión fallidos en las últimas 24 horas
  - Tableros, conexiones activas, tamaño de la base de datos
  - Avisos sobre aprobaciones pendientes y ajustes que faltan
  - **Métricas del sistema**, actualizadas cada 5 segundos, con historial de los últimos 10 minutos:
    - Uso de CPU de vibeboard y del host, carga del sistema
    - Memoria de vibeboard y del contenedor o del host
    - Tiempo de respuesta del bucle de eventos
    - espacio libre en disco para la aplicación y las copias de seguridad
    - Conexiones a la base de datos y tasa de aciertos de la caché
    - Conexiones en tiempo real, tiempo de actividad, versión de Node.js
    - Los mosaicos con cuellos de botella se resaltan en rojo.
- **Gestión de usuarios:**
  - Búsqueda y filtros (pendientes, sin confirmar, desactivados, administradores, sin dos pasos)
  - Crear usuarios, preferiblemente mediante un correo de invitación, para que la persona establezca ella misma su contraseña
  - editar, activar, desactivar, conceder derechos de administrador
  - Reenviar el correo de confirmación o confirmar el correo electrónico manualmente
  - Generar un enlace de contraseña, restablecer los dos pasos, cerrar todas las sesiones
  - eliminar, transfiriendo los tableros o eliminándolos también; el último administrador está protegido
- **Tableros:** todos los tableros con propietario, miembros y recurso compartido; cambiar el propietario, eliminar
- **General:** Nombre de la instancia, dirección pública, modo de registro
- **Seguridad:** Longitud mínima de la contraseña, comparación con «Have I Been Pwned», direcciones desechables,
  dominios bloqueados o permitidos, obligatoriedad de los dos pasos para administradores
- **Colaboración:** Correos por menciones, acceso de invitados (desactivado por defecto) y su validez máxima, quién puede
  crear equipos, permitir grabaciones y su duración máxima, archivos adjuntos y tamaño máximo de archivo, conservación en la
  papelera, webhooks (desactivados por defecto) y si se permiten destinos internos de webhooks
- **Servidor de correo:** Host SMTP, puerto, cifrado (STARTTLS, SSL/TLS, ninguno), inicio de sesión, remitente,
  comprobación del certificado; correo de prueba también antes de guardar
- **Aviso legal:** Editar y publicar el aviso legal y la política de privacidad (véase más abajo)
- **Registro:** Registro de seguridad de los últimos 12 meses con búsqueda y filtro. Contiene
  - inicios de sesión e intentos fallidos,
  - cambios de contraseña, de correo electrónico y de dos pasos,
  - acciones de administración con dirección IP.

### Aviso legal y política de privacidad

- En **Administración → Aviso legal** se mantienen y publican ambos textos. El editor admite formato sencillo
  (títulos, párrafos, listas, negrita, cursiva, enlaces) y muestra una vista previa en vivo.
- **Plantillas** para insertar:
  - un aviso legal conforme al § 5 DDG
  - una política de privacidad adaptada al tratamiento de datos real de vibeboard (cuenta, contenido de los
    tableros, cookie de sesión, registro de seguridad, correos electrónicos, opcionalmente Pwned Passwords, derechos de los interesados)

  Los marcadores de posición están entre [corchetes]. Las plantillas no sustituyen el asesoramiento jurídico.
- Las páginas `/impressum` y `/datenschutz` son accesibles **sin iniciar sesión**.
- Están enlazadas en la página de inicio de sesión y de registro, en el resumen de tableros, en el menú de ajustes de los
  tableros y en la administración.
- Los textos vacíos no se publican; sus enlaces desaparecen entonces automáticamente.
- Los textos se muestran sin HTML. El marcado introducido aparece como texto sin formato; los enlaces solo se permiten con http(s),
  mailto y tel.

---

## Accesibilidad

Fuera del lienzo, vibeboard aspira a WCAG 2.2 AA en los temas claro y oscuro: diálogos y menús totalmente manejables con el teclado, foco visible, enlaces de salto, avisos para lectores de pantalla y movimiento reducido. En un tablero, la *Lista de elementos* ofrece el contenido como texto; un elemento elegido se mueve con las flechas. Dibujar y colocar libremente en el lienzo sigue siendo visual. Las comprobaciones automáticas con axe-core se superan, pero falta una prueba con lectores de pantalla reales.

## Idiomas

La interfaz, las plantillas, los mensajes de error y los correos electrónicos están disponibles en inglés, alemán, español y francés.

- El idioma sigue los ajustes del navegador (primer idioma compatible); si no, se aplica el inglés. No hay una
  selección propia en la aplicación.
- Los correos se envían en el último idioma utilizado por la persona destinataria; las invitaciones a direcciones sin
  cuenta, en el idioma de la persona que invita.
- Las plantillas se crean en el idioma de la persona que las inserta; el contenido de los tableros no se traduce.
- Las plantillas del aviso legal y de la política de privacidad están en alemán porque se refieren a la legislación
  alemana. El operador es responsable de estos textos y los introduce él mismo en Administración → Aviso legal.
- Los diccionarios están en `public/i18n/`; `npm run check:i18n` los comprueba. El idioma de origen en el código es el alemán.
  Los documentos de requisitos de `docs/anforderungen/` están en alemán.

## Protección antivirus para las cargas

- **Qué se comprueba:** Cada archivo subido, antes de guardarse o de distribuirse a otras personas:
  - Imágenes mediante carga, arrastrar y soltar o portapapeles
  - Imágenes de tableros importados
  - Imágenes en miniatura
- **Cómo se comprueba:**
  - Con ClamAV mediante el protocolo clamd. En la configuración con Docker, ClamAV se ejecuta como servicio propio y
    actualiza sus firmas por sí mismo varias veces al día (`freshclam`).
  - Además, el contenido del archivo debe corresponder al tipo de imagen indicado (PNG, JPEG, GIF, WebP, SVG).
- **Si se detecta algo:**
  - El archivo no se guarda y se retira de nuevo de la persona que lo subió; esta ve un mensaje con el
    nombre de la detección.
  - El suceso queda en el registro de seguridad.
- **Sin analizador:**
  - Si no hay ningún analizador configurado o no está accesible, las cargas se rechazan por defecto. Ambas cosas se
    pueden ajustar en la administración, en «Seguridad».
- **Registro:** Cada resultado de comprobación consta en el registro de la aplicación (`[uploads]`, con resultado, tipo de
  archivo, tamaño, hash corto, duración e ID de usuario; nunca el contenido). Las detecciones, los tipos de archivo
  rechazados y los archivos aceptados sin comprobar por una caída del analizador constan además en el registro de seguridad.
- **En la administración:** El estado y la situación de las firmas aparecen en el resumen, junto con las cargas bloqueadas
  y las aceptadas sin comprobar de los últimos 30 días. Si las firmas tienen más de tres días, aparece una advertencia.

## Versiones y actualizaciones

- **Números de versión:** vibeboard sigue el [versionado semántico](https://semver.org/lang/es/). La versión figura en
  `package.json` y todos los cambios en el [CHANGELOG](CHANGELOG.md).
- **Actualización automática al arrancar:** Cuando se inicia una versión nueva, esta actualiza la base de datos por sí
  misma, incluso a lo largo de varias versiones:
  1. Un bloqueo de la base de datos impide actualizaciones paralelas de varias instancias.
  2. Si hay migraciones pendientes, primero se crea una **copia de seguridad** con `pg_dump` (Docker: volumen `backups`,
     se conservan las últimas 10). Si falla, la base de datos permanece sin cambios y el arranque se interrumpe.
  3. Las migraciones se ejecutan una tras otra, cada una en su propia transacción; un error se revierte por
     completo.
  4. La versión, la anterior y la copia de seguridad se registran en el historial de versiones (Administración → Resumen).
- **Protección contra la reversión:** Una versión anterior no arranca sobre una base de datos que ya ha usado una más reciente.
- **Los tableros abiertos** reciben tras una actualización el aviso «Recargar».
- **Actualización en la configuración con Docker:** `git pull && docker compose up -d --build`.
- **Restaurar una copia de seguridad:**
  `docker compose exec -T db pg_restore -U vibeboard -d vibeboard --clean < sicherung.dump`
  (antes, `docker compose stop app`).

---

## Registro

- **Niveles** según el esquema habitual:

  | Nivel | Contenido |
  |---|---|
  | `fatal` | Errores que ponen fin al funcionamiento (p. ej., fallo al arrancar) |
  | `error` | Errores que alguien debería corregir (p. ej., envío de correo, guardado, errores inesperados del servidor con stacktrace) |
  | `warn` | Anomalías sin caída (p. ej., actualización sin copia de seguridad, cargas rechazadas, solicitudes lentas de más de 2 s) |
  | `info` | procesos importantes (arranque, actualizaciones, nivel de registro cambiado) – **por defecto** |
  | `debug` | además, cada solicitud (método, ruta, estado, duración) y las solicitudes rechazadas |
  | `trace` | todo |

- **Configuración:**
  - Mediante `LOG_LEVEL` o en la administración, en «General → Registro».
  - El ajuste de la administración se aplica de inmediato y se conserva tras los reinicios.
- **Formato:**
  - `LOG_FORMAT=text` genera líneas legibles con marca de tiempo (UTC), nivel, componente y campos.
  - `LOG_FORMAT=json` escribe una línea JSON por entrada, para sistemas de recopilación de registros.
  - Los errores y advertencias van a stderr; todo lo demás, a stdout.
  - Consulta en la configuración con Docker: `docker compose logs -f app`.
- **ID de solicitud:**
  - Cada solicitud recibe un ID. Figura en la cabecera `X-Request-Id` y en todas las entradas de registro de esa solicitud.
  - En caso de errores del servidor, el navegador también recibe el ID, para poder localizar un error en el registro.
  - Un proxy colocado delante puede aportar su propio ID.
- **Minimización de datos:**
  - Las contraseñas, los tokens, las cookies y las claves se ocultan automáticamente.
  - No se registran direcciones IP, direcciones de correo electrónico, parámetros de consulta ni contenido de los tableros.
  - Los sucesos relevantes para la seguridad constan por separado en el registro de seguridad de la administración.

## Seguridad

**Cuentas**
- Contraseñas: scrypt con N=2¹⁷, r=8, p=1 (recomendación de OWASP) y sal; comparación en tiempo constante, también con
  nombres de usuario desconocidos. Los hashes antiguos se renuevan automáticamente en el siguiente inicio de sesión.
- Como máximo dos cálculos de hash a la vez, para que los intentos masivos de inicio de sesión no sobrecarguen el servidor.
- Límites de frecuencia para el inicio de sesión, el registro, los códigos de dos pasos, «Contraseña olvidada» y los correos de confirmación.
- Los códigos TOTP no se pueden reutilizar; los códigos de recuperación se guardan solo como hash.
- Protección contra el sondeo de cuentas:
  - «Contraseña olvidada» y «Reenviar el correo de confirmación» responden siempre igual.
  - Un registro con una dirección de correo electrónico ya utilizada parece, desde fuera, un registro normal.
    En su lugar se informa por correo electrónico a la persona titular de la dirección.
- Los enlaces de un solo uso (confirmación, restablecimiento, invitación) son aleatorios (256 bits), de duración limitada y solo se pueden usar una vez.
  En la base de datos solo consta su hash.

**Sesiones**
- La cookie de sesión es `HttpOnly`, `SameSite=Lax` y, con HTTPS, `Secure` con el prefijo `__Host-`. En la base de datos
  solo consta un hash SHA-256 del token.
- Las sesiones caducan a los 30 días o a los 14 días sin actividad.
- El cambio de contraseña, la desactivación y el cierre de sesión finalizan también las conexiones en vivo abiertas.

**Web**
- Content-Security-Policy estricta: solo scripts propios, sin scripts en línea, sin fuentes externas, sin incrustación en
  marcos.
- Otras cabeceras: HSTS (con HTTPS), `X-Frame-Options: DENY`, `X-Content-Type-Options`,
  `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `Referrer-Policy`, `Permissions-Policy`
  (micrófono solo para el propio sitio, para recorridos con sonido; sin cámara, sin ubicación).
- Protección CSRF: Las llamadas a la API que modifican datos necesitan la cabecera `X-Vibeboard: 1`.
- Los permisos se comprueban en el servidor, para la API REST y el canal en tiempo real, incluidos los permisos de
  comentarios, moderación y equipo. Todas las interfaces que no los permitan expresamente rechazan los accesos de invitados.
- Los elementos del tablero se comprueban en el servidor y al representarlos (lista blanca de colores, números forzados,
  imágenes solo incrustadas). Así no se puede introducir ningún marcado ni script.
- Los enlaces de los correos se generan solo a partir de la dirección pública configurada o de direcciones de este equipo. Una
  cabecera `Host` falsificada no puede redirigirlos.
- Tiempos de espera contra conexiones lentas (Slowloris), límites de tamaño para las solicitudes.

**Operación**
- El contenedor Docker de la aplicación se ejecuta como usuario normal con sistema de archivos de solo lectura, sin
  capacidades de Linux y con `no-new-privileges`.
- Sin una contraseña de base de datos definida, docker-compose no arranca.
- Para el funcionamiento en internet hace falta delante un proxy inverso con HTTPS (p. ej., Caddy, nginx, Traefik). Establece entonces
  `TRUST_PROXY=1` y `PUBLIC_URL`.

### Direcciones IP reales en el registro

Si en el registro aparece para todos los accesos la misma dirección privada, como `172.20.0.1`, vibeboard no está viendo
la dirección de los usuarios, sino la de la red de Docker (puerta de enlace). Esto ocurre cuando

- un **proxy inverso en el host** (nginx, Caddy, Apache) reenvía a `localhost:3000`: Docker pasa entonces la
  conexión mediante su proceso auxiliar `docker-proxy`, o
- los usuarios acceden por **IPv6** o desde el propio servidor: esto también pasa por `docker-proxy`.

Solución:

1. **Con proxy inverso (recomendado):** El proxy debe establecer la cabecera `X-Forwarded-For` (Caddy y Traefik lo hacen
   por sí mismos; en nginx, `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` y
   `proxy_set_header X-Forwarded-Proto $scheme;`). Después, en el `.env`, `TRUST_PROXY=1`.
   Importante: El puerto de la aplicación debe ser entonces accesible **solo para el proxy**; de lo contrario, quien llame podría establecer la
   cabecera por su cuenta y simular una dirección falsa. Para ello, establece en el `.env` `PORT=127.0.0.1:3000`:
   docker-compose publica entonces el puerto solo en el propio host.
2. **Sin proxy inverso:** Para los accesos IPv4 desde fuera, vibeboard ve la dirección real si Docker no usa el
   `docker-proxy`: introduce `{ "userland-proxy": false }` en `/etc/docker/daemon.json` y reinicia Docker.
   Para IPv6, la red de Docker debe admitir IPv6; si no, solo queda el proxy inverso.

La administración (resumen) muestra un aviso si la propia solicitud llega con una dirección de puerta de enlace de Docker o con
`X-Forwarded-For` pero sin `TRUST_PROXY`.

## Almacenamiento de datos y privacidad

Todos los datos están en tu propia base de datos PostgreSQL:

| Tabla | Contenido |
|---------|--------|
| `users` | Cuentas con rol, estado, momento de confirmación, hash de contraseña, clave de dos pasos, códigos de recuperación con hash |
| `sessions` | Sesiones de inicio de sesión (hash del token, dispositivo, dirección IP, última actividad) |
| `tokens` | Enlaces de un solo uso para confirmación, invitación y restablecimiento de contraseña (solo como hash) |
| `audit_log` | Registro de seguridad, conservado 12 meses |
| `settings` | Ajustes de la instancia, incluido el acceso SMTP |
| `boards`, `board_members`, `board_visits` | Tableros, recursos compartidos, tableros abiertos recientemente (para «desde tu última visita») |
| `elements` | Un registro por elemento del tablero; las imágenes se incrustan reducidas |
| `board_versions` | Versiones guardadas de los tableros |
| `notifications` | Notificaciones (mención, respuesta, asignación), conservadas 90 días |
| `board_activity` | Historial de actividad, resumido, 90 días o como máximo 2000 entradas por tablero |
| `guest_links` | Enlaces de invitado (solo como hash) con rol y caducidad; los accesos de invitado son cuentas con el rol `guest` |
| `teams`, `team_members`, `folders`, `folder_boards` | Equipos, pertenencias, carpetas |
| `board_recordings` | Recorridos grabados con pista de tiempo y pista de audio opcional |
| `team_invitations`, `pending_invites` | Invitaciones pendientes a equipos o a direcciones sin cuenta (dirección, rol, persona que invita; como máximo 30 días) |
| `board_files` | Archivos adjuntos (contenido, nombre, tipo, tamaño, vista previa de PDF); se eliminan a los 7 días si no tienen referencia |
| `board_polls` | Resultados de encuestas rápidas (solo el número por respuesta, sin votos individuales) |
| `user_templates` | Plantillas propias y de equipo |
| `webhooks` | Conexiones con chats (dirección, formato, eventos, último estado) |

- Solo hay conexiones salientes hacia el servidor de correo configurado y, si está activada, hacia la API de Pwned Passwords y
  hacia los webhooks configurados por los usuarios.
- En el navegador, vibeboard solo guarda ajustes de vista (zoom, tema oscuro, opciones de herramientas) en el `localStorage`;
  el service worker de la aplicación instalable conserva la interfaz y los scripts para el caso sin conexión (sin datos de los tableros).
- El repositorio no contiene datos de usuarios: `data/`, `.env` y los archivos de base de datos están excluidos en `.gitignore`.

---

## Actualización de dependencias

Dependabot vigila los paquetes npm, GitHub Actions y la imagen base de Docker. Las actualizaciones de seguridad llegan de inmediato; las demás esperan siete días para que una versión manipulada pueda detectarse antes. Las actualizaciones patch y minor se integran automáticamente si pasan todas las comprobaciones; las major requieren revisión. Las actualizaciones llegan a tu servidor con el siguiente `git pull` y la reconstrucción. Las demás imágenes se obtienen con `docker compose pull`.

## Requisitos y colaboración

- [docs/anforderungen](docs/anforderungen/README.md) describe todas las funciones como requisitos con ID permanentes
  y criterios de aceptación (los documentos de requisitos están en alemán).
- [CONTRIBUTING.md](CONTRIBUTING.md) establece qué debe acompañar a cada función nueva:
  - Añadir el requisito
  - Subir la versión
  - Completar el CHANGELOG
  - Migración y prueba de actualización

---

## Arquitectura

```
server.js              HTTP-Server, Seiten-Routing, Sicherheits-Header, CSRF-Schutz, Timeouts
lib/
  db.js                PostgreSQL-Pool, Schema-Migrationen
  auth.js              Kennwort-Hashes, Sessions, Einmal-Tokens, Zwei-Faktor-Tickets, Rate-Limits
  password.js          Kennwortrichtlinie (Länge, Listen, Muster, optional HIBP)
  email.js             E-Mail-Prüfung, Wegwerf-Domains, Sperr-/Erlaubnislisten
  totp.js              Zeitbasierte Einmalcodes (RFC 6238), Wiederherstellungscodes
  audit.js             Sicherheitsprotokoll
  version.js           Versionsverwaltung, automatisches Upgrade, Sicherung, Downgrade-Schutz
  virusscan.js         ClamAV-Anbindung (clamd), Dateityp-Prüfung
  uploads.js           Prüfrichtlinie für hochgeladene Dateien
  boards.js            Zugriffsrechte, Board-Cache, verzögertes Speichern, Echtzeit-Räume, Long-Polling,
                       privater Modus, Schätzrunden, Versionen, Moderation
  comments.js          Kommentar-Operationen (Autorschaft, Erwähnungen, Zuweisung)
  notify.js            Benachrichtigungen (Glocke, live, E-Mail)
  activity.js          Aktivitätsverlauf (zusammengefasst)
  guests.js            Gastlinks und Gastzugänge
  teams.js             Teams und Ordner
  recordings.js        Aufgezeichnete Rundgänge
  sanitize.js          Prüfung von Board-Elementen
  settings.js          Einstellungen der Instanz
  mail.js              E-Mail-Versand
  setup.js             Admin aus Umgebungsvariablen, Import alter Boards, Aufräumen
  routes/              REST-API: auth.js, boards.js, collab.js, admin.js, legal.js
  data/                Liste der Wegwerf-Domains und häufigen Kennwörter
scripts/test-upgrade.js  Upgrade-Test für Datenbank-Migrationen (npm run test:upgrade)
docs/anforderungen/      Anforderungsdokumente
public/
  auth.html            Anmelden, Registrieren, Bestätigen, Kennwort  → js/auth.js
  legal.html           Impressum, Datenschutzerklärung (öffentlich)  → js/legal.js, js/markdown.js
  index.html           Board-Übersicht                               → js/dashboard.js, js/notifications.js
  guest.html           Beitritt per Gastlink                         → js/guest.js
  board.html           Board-Editor                                  → js/main.js (core, ui, collab, render, sync, …)
                       teamwork.js (privater Modus, Schätzrunde), planning.js (Aufgaben, Versionen, CSV-Import),
                       moderation.js, activity.js, recording.js, notifications.js (Arbeiten im Team),
                       diagram-parse.js / diagram-text.js (Diagramm aus Text), highlight.js (Code-Blöcke),
                       templates.js / templates-tech.js / templates-diagrams.js / template-kit.js (Vorlagen)
  admin.html           Administration                                → js/admin.js
```

**Tiempo real:**
- Cada cliente recibe los cambios mediante Server-Sent Events (`/api/boards/:id/events`) y envía los suyos
  agrupados mediante POST.
- Si por el flujo no llega ningún saludo en 8 segundos, el cliente usa long polling
  (`/api/boards/:id/poll`). Para pruebas se puede forzar con `?transport=poll`.
- El servidor mantiene los tableros activos en memoria, distribuye los cambios de inmediato y los escribe agrupados en la
  base de datos.
- Si dos personas cambian a la vez el mismo elemento, gana el último cambio. Las tablas se concilian
  celda por celda; los comentarios, mediante operaciones propias (el servidor añade autor y momento).

---

## Licencia

vibeboard está bajo la [licencia MIT](LICENSE).

Excepciones y contenido de terceros, detalles en [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md):

- **Business Model Canvas**: adaptación del «Business Model Canvas» de Strategyzer AG (strategyzer.com), con licencia
  [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
- **Lean Canvas**: adaptación del «Lean Canvas» de Ash Maurya (leanstack.com), basado en el Business Model Canvas,
  con licencia [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
- **Iconos**: en parte procedentes de o basados en [Lucide](https://lucide.dev) (ISC) y [Feather](https://feathericons.com) (MIT).
- **Dominios desechables**: [disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains) (CC0).
- **Contraseñas frecuentes**: [SecLists](https://github.com/danielmiessler/SecLists) (MIT).

Los nombres de productos y métodos mencionados (p. ej., Jira, Azure DevOps, Excel, Microsoft Teams, Slack, Mattermost, Rocket.Chat,
Matrix, Kubernetes, Mermaid, UML, BPMN) pertenecen a sus respectivos titulares y sirven solo como descripción; esto no implica
ninguna relación ni respaldo. vibeboard es un proyecto de código abierto independiente, sin relación con Vibe, Inc. ni con
sus productos. No hay garantía; véase [LICENSE](LICENSE).
