/** stopwords-itsm@1.0 — NLTK English snapshot + ITSM extras. Keep-list never dropped. */
export const STOPWORD_VERSION = 'stopwords-itsm@1.0';

const NLTK = [
  'i','me','my','myself','we','our','ours','ourselves','you','your','yours','yourself','yourselves',
  'he','him','his','himself','she','her','hers','herself','it','its','itself','they','them','their',
  'theirs','themselves','what','which','who','whom','this','that','these','those','am','is','are',
  'was','were','be','been','being','have','has','had','having','do','does','did','doing','a','an',
  'the','and','but','if','or','because','as','until','while','of','at','by','for','with','about',
  'against','between','into','through','during','before','after','above','below','to','from','up',
  'down','in','out','on','off','over','under','again','further','then','once','here','there','when',
  'where','why','how','all','any','both','each','few','more','most','other','some','such','no','nor',
  'not','only','own','same','so','than','too','very','s','t','can','will','just','don','should','now',
  'd','ll','m','o','re','ve','y','ain','aren','couldn','didn','doesn','hadn','hasn','haven','isn','ma',
  'mightn','mustn','needn','shan','shouldn','wasn','weren','won','wouldn',
];

const ITSM = [
  'please','thanks','thank','ticket','tickets','user','users','issue','issues','incident','incidents',
  'resolved','closed','team','still','also','able','need','needs','needed','request','requests',
  'reported','reporting','hello','hi','regards','sent','dear','help','trying','tried','working',
  'works','getting','get','got','see','seen','let','know','update','updated','today','yesterday',
  'via','per','new','old','called','normally','fixed','added','file','files','normally',
];

export const KEEP_LIST = new Set([
  'vpn','mfa','sap','duo','zoom','chrome','outlook','wifi','hvac','badge','printer','laptop',
  'password','okta','azure','teams',
]);

export const STOPWORDS = new Set(
  [...NLTK, ...ITSM].filter((w) => !KEEP_LIST.has(w)),
);
