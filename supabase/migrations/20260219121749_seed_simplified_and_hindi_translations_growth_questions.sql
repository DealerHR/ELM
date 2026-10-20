/*
  # Seed simplified English + Hindi translations for all 50 growth profile questions

  All question text has been rewritten in plain, simple English suitable for
  non-native or lower-proficiency English speakers. Hindi translations are provided
  for all questions and answer options to support SME audiences.
*/

-- Q1
UPDATE growth_profile_questions SET
  question_text_simple = 'Your team suddenly starts using a new work tool. You have two weeks to learn it. What do you do in the first week?',
  option_1_simple = 'I explore it myself and learn it quickly',
  option_2_simple = 'I follow the training and learn it on time',
  option_3_simple = 'I feel frustrated but I keep trying',
  option_4_simple = 'I ask a colleague to help me with the hard parts',
  option_5_simple = 'I learn the basics but need more time for advanced things',
  question_text_hi = 'आपकी टीम अचानक एक नया काम का टूल इस्तेमाल करना शुरू करती है। आपके पास सीखने के लिए दो हफ्ते हैं। पहले हफ्ते में आप क्या करते हैं?',
  option_1_hi = 'मैं खुद इसे explore करता हूँ और जल्दी सीख लेता हूँ',
  option_2_hi = 'मैं training follow करता हूँ और समय पर सीख लेता हूँ',
  option_3_hi = 'मुझे frustration होती है लेकिन मैं कोशिश करता रहता हूँ',
  option_4_hi = 'मुझे मुश्किल हिस्सों में एक colleague से मदद लेता हूँ',
  option_5_hi = 'मैं basic चीजें सीखता हूँ लेकिन advanced के लिए ज्यादा समय चाहिए'
WHERE question_number = 1;

-- Q2
UPDATE growth_profile_questions SET
  question_text_simple = 'Think of the last time you had to learn something new at work without any training. What did you do?',
  option_1_simple = 'I waited for someone to teach me',
  option_2_simple = 'I found guides online and worked through them step by step',
  option_3_simple = 'I tried things out, made mistakes, and figured it out myself',
  option_4_simple = 'I asked a colleague to show me, then practised on my own',
  option_5_simple = 'I watched one tutorial and felt ready straight away',
  question_text_hi = 'वह आखिरी बार याद करें जब आपको बिना किसी training के काम पर कुछ नया सीखना पड़ा। आपने क्या किया?',
  option_1_hi = 'मैंने इंतजार किया कि कोई मुझे सिखाए',
  option_2_hi = 'मैंने online guides ढूंढे और step by step सीखा',
  option_3_hi = 'मैंने try किया, गलतियाँ कीं, और खुद ही समझ लिया',
  option_4_hi = 'एक colleague ने मुझे दिखाया, फिर मैंने खुद practice की',
  option_5_hi = 'मैंने एक tutorial देखा और तुरंत तैयार महसूस किया'
WHERE question_number = 2;

-- Q3
UPDATE growth_profile_questions SET
  question_text_simple = 'Which of these two statements is more like you when you work?',
  option_1_simple = 'I work best when I have clear rules and a structure to follow',
  option_2_simple = 'I work best when I am free to decide my own way of doing things',
  question_text_hi = 'काम करते समय इनमें से कौन सा कथन आपके जैसा है?',
  option_1_hi = 'मैं तब सबसे अच्छा काम करता हूँ जब मेरे पास follow करने के लिए clear rules और structure हो',
  option_2_hi = 'मैं तब सबसे अच्छा काम करता हूँ जब मैं खुद अपना तरीका तय कर सकता हूँ'
WHERE question_number = 3;

-- Q4
UPDATE growth_profile_questions SET
  question_text_simple = 'An important work process breaks down on a Friday afternoon. IT support is not available until Monday. What do you do?',
  option_1_simple = 'I write down what happened, find a temporary fix, and inform my manager for Monday',
  option_2_simple = 'I try to contact IT or someone who knows the system, even outside working hours',
  option_3_simple = 'I stop the affected work and resume everything on Monday',
  option_4_simple = 'I search online and try to fix it myself before giving up',
  option_5_simple = 'I tell my manager and ask them to handle it',
  question_text_hi = 'शुक्रवार की दोपहर एक जरूरी काम का process बंद पड़ जाता है। IT support सोमवार तक नहीं मिलेगी। आप क्या करते हैं?',
  option_1_hi = 'मैं लिख लेता हूँ क्या हुआ, एक temporary fix निकालता हूँ, और manager को Monday के लिए बताता हूँ',
  option_2_hi = 'मैं IT या किसी जानकार से संपर्क करने की कोशिश करता हूँ, चाहे काम के घंटों के बाहर भी',
  option_3_hi = 'मैं affected काम रोक देता हूँ और सोमवार को resume करता हूँ',
  option_4_hi = 'मैं online search करता हूँ और हार मानने से पहले खुद ठीक करने की कोशिश करता हूँ',
  option_5_hi = 'मैं अपने manager को बताता हूँ और उन्हें संभालने के लिए कहता हूँ'
WHERE question_number = 4;

-- Q5
UPDATE growth_profile_questions SET
  question_text_simple = 'When a process you use every day is replaced with a new one, what usually happens over the next month?',
  option_1_simple = 'It takes me longer than others to get comfortable with the change',
  option_2_simple = 'I adapt at roughly the same pace as my colleagues',
  option_3_simple = 'I adapt faster than most people, though I still have some questions',
  option_4_simple = 'I get it quickly and help others who are still struggling',
  option_5_simple = 'I put in extra time early so I can become the go-to person for the team',
  question_text_hi = 'जब आप रोज जो process use करते हैं उसे एक नई process से बदला जाता है, तो अगले महीने आमतौर पर क्या होता है?',
  option_1_hi = 'मुझे बदलाव से comfortable होने में दूसरों से ज्यादा समय लगता है',
  option_2_hi = 'मैं अपने colleagues के जैसी ही speed से adapt करता हूँ',
  option_3_hi = 'मैं ज्यादातर लोगों से तेज adapt करता हूँ, हालाँकि कुछ सवाल रहते हैं',
  option_4_hi = 'मैं जल्दी समझ जाता हूँ और उन लोगों की मदद करता हूँ जो अभी struggle कर रहे हैं',
  option_5_hi = 'मैं शुरुआत में extra समय लगाता हूँ ताकि team में सबका resource बन सकूँ'
WHERE question_number = 5;

-- Q6
UPDATE growth_profile_questions SET
  question_text_simple = 'You are given a project that needs a skill you have never used before. The deadline is in three weeks. What do you do?',
  option_1_simple = 'I quickly figure out what I need to learn and make a plan',
  option_2_simple = 'I find learning materials and practise while working on the project',
  option_3_simple = 'I ask for more time and request a mentor to guide me',
  option_4_simple = 'I do what I can and tell my manager about the skill gap early',
  option_5_simple = 'I feel unsure but commit to figuring it out as I go',
  question_text_hi = 'आपको एक ऐसा project दिया जाता है जिसके लिए आपने कभी कोई skill use नहीं की। deadline तीन हफ्ते में है। आप क्या करते हैं?',
  option_1_hi = 'मैं जल्दी पता लगाता हूँ कि क्या सीखना है और एक plan बनाता हूँ',
  option_2_hi = 'मैं learning materials ढूंढता हूँ और project पर काम करते हुए practice करता हूँ',
  option_3_hi = 'मैं ज्यादा समय मांगता हूँ और guide करने के लिए mentor की request करता हूँ',
  option_4_hi = 'मैं जो कर सकता हूँ वो करता हूँ और manager को skill gap के बारे में जल्दी बताता हूँ',
  option_5_hi = 'मुझे uncertainty लगती है लेकिन मैं आगे बढ़ते हुए समझने का commitment करता हूँ'
WHERE question_number = 6;

-- Q7
UPDATE growth_profile_questions SET
  question_text_simple = 'Which of these two statements is more like how you feel when starting something new at work?',
  option_1_simple = 'I work best when I know exactly what the final result should look like from the beginning',
  option_2_simple = 'I work best when I can discover what the final result looks like as the work progresses',
  question_text_hi = 'काम पर कुछ नया शुरू करते समय इनमें से कौन सा आपके जैसा है?',
  option_1_hi = 'मैं तब सबसे अच्छा काम करता हूँ जब मुझे शुरुआत से ही पता हो कि अंतिम result कैसा दिखना चाहिए',
  option_2_hi = 'मैं तब सबसे अच्छा काम करता हूँ जब काम बढ़ने के साथ-साथ मैं समझ सकूँ कि result क्या होगा'
WHERE question_number = 7;

-- Q8
UPDATE growth_profile_questions SET
  question_text_simple = 'Looking at your work in the last six months, how would you describe your approach to tasks?',
  option_1_simple = 'I mostly followed the set process and passed on anything different to my manager',
  option_2_simple = 'I mostly followed the process but sometimes suggested small improvements',
  option_3_simple = 'I followed the process where it worked and found alternatives where it did not',
  option_4_simple = 'I regularly looked for improvements and changed the way things were done',
  option_5_simple = 'I treated most processes as a starting point and regularly found better ways',
  question_text_hi = 'पिछले छह महीनों में अपने काम को देखते हुए, आप अपने approach को कैसे describe करेंगे?',
  option_1_hi = 'मैंने ज्यादातर set process follow की और कुछ भी अलग होने पर manager को pass किया',
  option_2_hi = 'मैंने ज्यादातर process follow की लेकिन कभी-कभी छोटे सुधार सुझाए',
  option_3_hi = 'जहाँ process काम आई वहाँ follow की और जहाँ नहीं आई वहाँ alternative ढूंढा',
  option_4_hi = 'मैंने नियमित रूप से improvements ढूंढे और काम करने के तरीके बदले',
  option_5_hi = 'मैंने ज्यादातर processes को एक शुरुआत माना और नियमित रूप से बेहतर तरीके खोजे'
WHERE question_number = 8;

-- Q9
UPDATE growth_profile_questions SET
  question_text_simple = 'A big change in your industry means you need to learn skills you have never had before. What do you typically do?',
  option_1_simple = 'I sign up for a formal course and work through it step by step',
  option_2_simple = 'I read widely from many sources and form my own understanding',
  option_3_simple = 'I find someone already working in this area and learn by talking to them',
  option_4_simple = 'I wait for my employer to give me specific guidance or training',
  option_5_simple = 'I start applying the new ideas to my current work straight away to learn by doing',
  question_text_hi = 'आपके industry में एक बड़े बदलाव का मतलब है कि आपको ऐसी skills सीखनी होंगी जो आपके पास कभी नहीं थीं। आप आमतौर पर क्या करते हैं?',
  option_1_hi = 'मैं एक formal course join करता हूँ और step by step सीखता हूँ',
  option_2_hi = 'मैं कई sources से पढ़ता हूँ और अपनी खुद की समझ बनाता हूँ',
  option_3_hi = 'मैं ऐसा कोई ढूंढता हूँ जो पहले से इस area में काम कर रहा हो और बातचीत से सीखता हूँ',
  option_4_hi = 'मैं तब तक इंतजार करता हूँ जब तक employer खास guidance या training न दे',
  option_5_hi = 'मैं तुरंत नए ideas को अपने काम में apply करना शुरू करता हूँ ताकि करते हुए सीख सकूँ'
WHERE question_number = 9;

-- Q10 (social desirability trap)
UPDATE growth_profile_questions SET
  question_text_simple = 'Thinking honestly about your career so far, which of these is most true for you?',
  option_1_simple = 'I have struggled to adapt to several changes at work',
  option_2_simple = 'There have been one or two big changes that took me longer than expected to adjust to',
  option_3_simple = 'I usually adapt well, though some situations were challenging',
  option_4_simple = 'I adapt quickly in most situations and rarely find change difficult',
  option_5_simple = 'I have never had any difficulty adapting to any change at work',
  question_text_hi = 'अपने career के बारे में ईमानदारी से सोचते हुए, इनमें से कौन सा आपके लिए सबसे सच है?',
  option_1_hi = 'काम पर कई बदलावों के साथ adapt करने में मुझे struggle हुई है',
  option_2_hi = 'एक-दो बड़े बदलाव थे जिनसे adjust होने में मुझे उम्मीद से ज्यादा समय लगा',
  option_3_hi = 'मैं आमतौर पर अच्छी तरह adapt करता हूँ, हालाँकि कुछ situations मुश्किल थीं',
  option_4_hi = 'मैं ज्यादातर situations में जल्दी adapt करता हूँ और शायद ही कभी change मुश्किल लगता है',
  option_5_hi = 'काम पर किसी भी बदलाव के साथ adapt करने में मुझे कभी कोई कठिनाई नहीं हुई'
WHERE question_number = 10;

-- Q11
UPDATE growth_profile_questions SET
  question_text_simple = 'When working on a project that takes several weeks, how do you typically keep your manager informed?',
  option_1_simple = 'I give regular updates without being asked and raise problems early',
  option_2_simple = 'I update at key points and check in when I am stuck',
  option_3_simple = 'I update my manager when I have something worth sharing',
  option_4_simple = 'I wait for my manager to ask me, then give a status',
  option_5_simple = 'I prefer to work on my own and present a finished result',
  question_text_hi = 'जब आप कई हफ्तों के project पर काम करते हैं, तो आप आमतौर पर अपने manager को कैसे inform रखते हैं?',
  option_1_hi = 'मैं बिना कहे regular updates देता हूँ और problems जल्दी raise करता हूँ',
  option_2_hi = 'मैं key points पर update देता हूँ और जब stuck हो जाता हूँ तब check in करता हूँ',
  option_3_hi = 'मैं manager को तब update करता हूँ जब मेरे पास share करने लायक कुछ हो',
  option_4_hi = 'मैं manager के पूछने का इंतजार करता हूँ, फिर status देता हूँ',
  option_5_hi = 'मैं अकेले काम करना पसंद करता हूँ और तैयार result present करता हूँ'
WHERE question_number = 11;

-- Q12
UPDATE growth_profile_questions SET
  question_text_simple = 'You notice something that wastes time and bothers the whole team, but it is not anyone''s responsibility to fix it. What do you do?',
  option_1_simple = 'I bring it up in the next team meeting',
  option_2_simple = 'I talk to my manager privately and suggest looking into it',
  option_3_simple = 'I investigate the problem myself and bring a suggested solution',
  option_4_simple = 'I mention it casually to a colleague and wait to see if leadership does something',
  option_5_simple = 'I fix what I can in my own area and document what needs a bigger solution',
  question_text_hi = 'आप देखते हैं कि एक चीज पूरी team का समय बर्बाद करती है, लेकिन इसे fix करना किसी की भी जिम्मेदारी में नहीं है। आप क्या करते हैं?',
  option_1_hi = 'मैं इसे अगली team meeting में उठाता हूँ',
  option_2_hi = 'मैं अपने manager से private में बात करता हूँ और इसे देखने का सुझाव देता हूँ',
  option_3_hi = 'मैं खुद समस्या की जांच करता हूँ और एक suggested solution लेकर आता हूँ',
  option_4_hi = 'मैं किसी colleague से casual बात करता हूँ और देखता हूँ कि leadership कुछ करती है या नहीं',
  option_5_hi = 'मैं अपने area में जो fix कर सकता हूँ वो करता हूँ और बड़े solution की जरूरत वाली चीज document करता हूँ'
WHERE question_number = 12;

-- Q13
UPDATE growth_profile_questions SET
  question_text_simple = 'A project you led misses an important deadline because of both your decisions and team issues. How do you explain this to leadership?',
  option_1_simple = 'I clearly explain what happened, take responsibility for my decisions, and outline the recovery plan',
  option_2_simple = 'I explain the contributing factors honestly, including my own role, and ask for guidance',
  option_3_simple = 'I present the facts without focusing on who did what',
  option_4_simple = 'I describe the team challenges while also acknowledging my own decisions played a part',
  option_5_simple = 'I explain what the team could have done differently and what I will change next time',
  question_text_hi = 'आपकी अगुआई में एक project एक जरूरी deadline miss करता है, आपके decisions और team की समस्याओं दोनों की वजह से। आप leadership को कैसे explain करते हैं?',
  option_1_hi = 'मैं clearly बताता हूँ क्या हुआ, अपने decisions की जिम्मेदारी लेता हूँ, और recovery plan outline करता हूँ',
  option_2_hi = 'मैं ईमानदारी से contributing factors बताता हूँ, अपना role भी, और guidance माँगता हूँ',
  option_3_hi = 'मैं facts present करता हूँ बिना इस पर focus किए कि किसने क्या किया',
  option_4_hi = 'मैं team की challenges describe करता हूँ और साथ ही acknowledge करता हूँ कि मेरे decisions का भी हिस्सा था',
  option_5_hi = 'मैं explain करता हूँ कि team ने क्या अलग कर सकती थी और मैं अगली बार क्या बदलूँगा'
WHERE question_number = 13;

-- Q14
UPDATE growth_profile_questions SET
  question_text_simple = 'Your project budget is cut by 30% one month before launch. What is your first reaction?',
  option_1_simple = 'I immediately look for things to cut that won''t affect the main results',
  option_2_simple = 'I talk to stakeholders to find out which results absolutely cannot be cut',
  option_3_simple = 'I ask for justification and escalate to leadership',
  option_4_simple = 'I reorder the work so the most important things are protected within the new budget',
  option_5_simple = 'I ask the team where savings can be found before making any decisions',
  question_text_hi = 'Launch से एक महीने पहले आपका project budget 30% कम हो जाता है। आपकी पहली प्रतिक्रिया क्या है?',
  option_1_hi = 'मैं तुरंत ऐसी चीजें ढूंढता हूँ जो cut की जा सकें बिना मुख्य results को affect किए',
  option_2_hi = 'मैं stakeholders से बात करता हूँ कि कौन से results absolutely नहीं काटे जा सकते',
  option_3_hi = 'मैं justification माँगता हूँ और leadership को escalate करता हूँ',
  option_4_hi = 'मैं काम को reorder करता हूँ ताकि नए budget में सबसे जरूरी चीजें protected रहें',
  option_5_hi = 'मैं कोई decision लेने से पहले team से पूछता हूँ कि savings कहाँ हो सकती हैं'
WHERE question_number = 14;

-- Q15
UPDATE growth_profile_questions SET
  question_text_simple = 'Which of these two statements is more like how you prefer to work?',
  option_1_simple = 'I prefer to agree on a clear goal first, then find my own path to reach it',
  option_2_simple = 'I prefer to agree on a clear goal first, then follow the established process to reach it',
  question_text_hi = 'इनमें से कौन सा काम करने का आपका पसंदीदा तरीका है?',
  option_1_hi = 'मैं पहले एक clear goal पर सहमत होना पसंद करता हूँ, फिर उस तक पहुँचने का अपना रास्ता खुद ढूंढता हूँ',
  option_2_hi = 'मैं पहले एक clear goal पर सहमत होना पसंद करता हूँ, फिर उस तक पहुँचने की established process follow करता हूँ'
WHERE question_number = 15;

-- Q16
UPDATE growth_profile_questions SET
  question_text_simple = 'In the past year, how many times have you suggested a process improvement or new idea at work without being asked?',
  option_1_simple = 'I cannot think of any time',
  option_2_simple = 'Once or twice — small suggestions that were accepted',
  option_3_simple = 'Two or three times — some led to real changes',
  option_4_simple = 'Several times — I regularly look for things to improve',
  option_5_simple = 'Very often — improving processes is a natural part of how I work',
  question_text_hi = 'पिछले एक साल में, आपने बिना कहे काम पर कितनी बार process improvement या नया idea suggest किया?',
  option_1_hi = 'मुझे कोई बार याद नहीं आती',
  option_2_hi = 'एक-दो बार — छोटे suggestions जो accept हुए',
  option_3_hi = 'दो-तीन बार — कुछ से असली बदलाव हुए',
  option_4_hi = 'कई बार — मैं नियमित रूप से improve करने की चीजें ढूंढता हूँ',
  option_5_hi = 'बहुत बार — processes improve करना मेरे काम करने का natural हिस्सा है'
WHERE question_number = 16;

-- Q17
UPDATE growth_profile_questions SET
  question_text_simple = 'When something goes wrong on a project, which is more like your first instinct?',
  option_1_simple = 'I immediately think about what I could have done differently, even before knowing everything',
  option_2_simple = 'I first understand all the contributing factors before deciding what my own role was',
  question_text_hi = 'जब project पर कुछ गलत होता है, तो आपकी पहली instinct कौन सी है?',
  option_1_hi = 'मैं तुरंत सोचता हूँ कि मैं क्या अलग कर सकता था, सब कुछ जानने से पहले भी',
  option_2_hi = 'मैं पहले सभी contributing factors समझता हूँ, फिर तय करता हूँ कि मेरा क्या role था'
WHERE question_number = 17;

-- Q18
UPDATE growth_profile_questions SET
  question_text_simple = 'When you have had to deliver a project with fewer resources than you needed, what result did you usually achieve?',
  option_1_simple = 'I delivered a smaller scope with the available resources',
  option_2_simple = 'I delivered the full scope but the quality was lower than planned',
  option_3_simple = 'I delivered the full scope on time by finding creative alternatives',
  option_4_simple = 'I delivered the full scope and found savings that helped later',
  option_5_simple = 'I asked for more resources before committing to the original scope',
  question_text_hi = 'जब आपको जरूरत से कम resources के साथ project deliver करना पड़ा, तो आमतौर पर क्या result मिला?',
  option_1_hi = 'मैंने available resources से एक छोटा scope deliver किया',
  option_2_hi = 'मैंने full scope deliver किया लेकिन quality planned से कम थी',
  option_3_hi = 'मैंने creative alternatives ढूंढकर full scope समय पर deliver किया',
  option_4_hi = 'मैंने full scope deliver किया और ऐसी savings निकाली जो बाद में काम आईं',
  option_5_hi = 'मैंने original scope के लिए commit करने से पहले ज्यादा resources माँगे'
WHERE question_number = 18;

-- Q19
UPDATE growth_profile_questions SET
  question_text_simple = 'Your manager is unexpectedly away for two weeks and no one is assigned to cover. How does your work output change?',
  option_1_simple = 'No change — I work the same way whether or not my manager is around',
  option_2_simple = 'Small disruption on decisions that normally need approval, otherwise fine',
  option_3_simple = 'I handle daily work but pause anything that needs serious judgement',
  option_4_simple = 'I rely on other senior colleagues for most decisions',
  option_5_simple = 'I note down all pending decisions and wait for my manager to return',
  question_text_hi = 'आपके manager अचानक दो हफ्ते के लिए दूर हो जाते हैं और कोई cover assign नहीं होता। आपका काम कैसे बदलता है?',
  option_1_hi = 'कोई बदलाव नहीं — मैं वैसे ही काम करता हूँ चाहे manager हो या न हो',
  option_2_hi = 'उन decisions पर छोटी disruption जिन्हें normally approval चाहिए, बाकी ठीक है',
  option_3_hi = 'मैं रोज का काम handle करता हूँ लेकिन serious judgement वाला काम pause करता हूँ',
  option_4_hi = 'ज्यादातर decisions के लिए मैं दूसरे senior colleagues पर depend करता हूँ',
  option_5_hi = 'मैं सभी pending decisions नोट करता हूँ और manager के वापस आने का इंतजार करता हूँ'
WHERE question_number = 19;

-- Q20 (social desirability trap)
UPDATE growth_profile_questions SET
  question_text_simple = 'Thinking honestly about how you work, which is most true for you?',
  option_1_simple = 'I sometimes put off tasks that are complex or uncomfortable',
  option_2_simple = 'I occasionally delay starting something difficult until I feel more ready',
  option_3_simple = 'I generally start tasks on time but sometimes delay the harder ones',
  option_4_simple = 'I rarely delay and usually start tasks as soon as I can',
  option_5_simple = 'I have never delayed an important work task',
  question_text_hi = 'अपने काम करने के तरीके के बारे में ईमानदारी से सोचते हुए, इनमें से कौन सा आपके लिए सबसे सच है?',
  option_1_hi = 'मैं कभी-कभी ऐसे tasks टालता हूँ जो complex या uncomfortable हों',
  option_2_hi = 'मैं कभी-कभी कुछ मुश्किल शुरू करने में delay करता हूँ जब तक मैं और तैयार न हो जाऊँ',
  option_3_hi = 'मैं आमतौर पर tasks समय पर शुरू करता हूँ लेकिन कभी-कभी मुश्किल वाले delay करता हूँ',
  option_4_hi = 'मैं शायद ही कभी delay करता हूँ और आमतौर पर जैसे ही हो सके tasks शुरू करता हूँ',
  option_5_hi = 'मैंने कभी कोई जरूरी काम का task delay नहीं किया'
WHERE question_number = 20;

-- Q21
UPDATE growth_profile_questions SET
  question_text_simple = 'In a team meeting where people have different views, what role do you usually take?',
  option_1_simple = 'I listen carefully and ask questions to understand everyone before I speak',
  option_2_simple = 'I share my view clearly and openly invite others to challenge it',
  option_3_simple = 'I look for what people agree on and help bring the group to a shared position',
  option_4_simple = 'I speak up when I have something specific to add, otherwise I let others lead',
  option_5_simple = 'I often end up summarising the discussion and helping the group decide',
  question_text_hi = 'एक team meeting में जहाँ लोगों के अलग-अलग views हों, आप आमतौर पर कौन सी role लेते हैं?',
  option_1_hi = 'मैं ध्यान से सुनता हूँ और बोलने से पहले सबको समझने के लिए सवाल पूछता हूँ',
  option_2_hi = 'मैं अपना view clearly share करता हूँ और openly दूसरों को challenge करने के लिए invite करता हूँ',
  option_3_hi = 'मैं देखता हूँ कि लोग किस बात पर सहमत हैं और group को एक shared position पर लाने में मदद करता हूँ',
  option_4_hi = 'जब मेरे पास कुछ specific add करने के लिए हो तब बोलता हूँ, वरना दूसरों को lead करने देता हूँ',
  option_5_hi = 'मैं अक्सर discussion summarise करता हूँ और group को decide करने में मदद करता हूँ'
WHERE question_number = 21;

-- Q22
UPDATE growth_profile_questions SET
  question_text_simple = 'A colleague is way behind on their work, which will affect the whole team. You are also very busy. What do you do?',
  option_1_simple = 'I talk to them to understand why they are behind and offer to help with specific parts',
  option_2_simple = 'I tell my manager about the risk and suggest a plan to share the work differently',
  option_3_simple = 'I focus on my own work but keep an eye on whether the team will be affected',
  option_4_simple = 'I offer general support but wait to see how serious it gets before acting',
  option_5_simple = 'I rearrange my own schedule and take on some of their work without being asked',
  question_text_hi = 'एक colleague अपने काम में काफी पीछे है, जिससे पूरी team affect होगी। आप भी बहुत busy हैं। आप क्या करते हैं?',
  option_1_hi = 'मैं उनसे बात करता हूँ कि क्यों पीछे हैं और specific parts में मदद offer करता हूँ',
  option_2_hi = 'मैं manager को risk बताता हूँ और काम अलग तरह से share करने का plan suggest करता हूँ',
  option_3_hi = 'मैं अपने काम पर focus करता हूँ लेकिन देखता रहता हूँ कि team affect होगी या नहीं',
  option_4_hi = 'मैं general support offer करता हूँ लेकिन act करने से पहले देखता हूँ कि कितना serious होता है',
  option_5_hi = 'मैं अपना schedule adjust करता हूँ और बिना कहे उनका कुछ काम ले लेता हूँ'
WHERE question_number = 22;

-- Q23
UPDATE growth_profile_questions SET
  question_text_simple = 'A colleague does something you are confident will cause problems later. What do you do?',
  option_1_simple = 'I raise my concern directly with them, explain my thinking, and listen to their response',
  option_2_simple = 'I write down my concern and share it with the relevant people',
  option_3_simple = 'I ask them to explain their thinking to see if I am missing something',
  option_4_simple = 'I mention it to my manager and let them decide whether to step in',
  option_5_simple = 'I clearly disagree in the next team meeting so it is on record',
  question_text_hi = 'एक colleague कुछ ऐसा करता है जिससे आपको यकीन है कि बाद में problems होंगी। आप क्या करते हैं?',
  option_1_hi = 'मैं सीधे उनसे concern raise करता हूँ, अपनी सोच explain करता हूँ, और उनका जवाब सुनता हूँ',
  option_2_hi = 'मैं अपनी concern लिखकर relevant लोगों के साथ share करता हूँ',
  option_3_hi = 'मैं उन्हें अपनी सोच explain करने के लिए कहता हूँ कि कहीं मैं कुछ miss तो नहीं कर रहा',
  option_4_hi = 'मैं manager को बताता हूँ और उन्हें decide करने देता हूँ कि intervene करना है या नहीं',
  option_5_hi = 'मैं अगली team meeting में clearly disagree करता हूँ ताकि record पर रहे'
WHERE question_number = 23;

-- Q24
UPDATE growth_profile_questions SET
  question_text_simple = 'When you have worked with teams from other departments, which best describes your usual experience?',
  option_1_simple = 'It takes real effort to deal with different priorities and ways of communicating',
  option_2_simple = 'It works but it is slower and less efficient than working within my own team',
  option_3_simple = 'I am equally comfortable working across teams as within my own team',
  option_4_simple = 'I find cross-team work interesting and often get better results with different people',
  option_5_simple = 'I actively look for cross-team work because of the different perspectives it brings',
  question_text_hi = 'जब आपने दूसरे departments की teams के साथ काम किया है, तो आपका आमतौर पर कैसा अनुभव रहा है?',
  option_1_hi = 'अलग-अलग priorities और communication के तरीकों से deal करने में real effort लगती है',
  option_2_hi = 'यह काम करता है लेकिन अपनी team के साथ काम करने से धीमा और कम efficient है',
  option_3_hi = 'मैं teams के across उतना ही comfortable हूँ जितना अपनी team के अंदर',
  option_4_hi = 'मुझे cross-team work interesting लगता है और अक्सर अलग-अलग लोगों के साथ बेहतर results मिलते हैं',
  option_5_hi = 'मैं actively cross-team work ढूंढता हूँ क्योंकि इससे अलग perspectives मिलते हैं'
WHERE question_number = 24;

-- Q25
UPDATE growth_profile_questions SET
  question_text_simple = 'Which of these two statements is more true of how you do your best work?',
  option_1_simple = 'I do my best work through regular conversations and collaboration with colleagues',
  option_2_simple = 'I do my best work through focused, uninterrupted time working on my own',
  question_text_hi = 'इनमें से कौन सा आपके सबसे अच्छे काम के बारे में ज्यादा सच है?',
  option_1_hi = 'मैं colleagues के साथ regular बातचीत और collaboration से अपना best काम करता हूँ',
  option_2_hi = 'मैं focused, uninterrupted समय में अकेले काम करके अपना best काम करता हूँ'
WHERE question_number = 25;

-- Q26
UPDATE growth_profile_questions SET
  question_text_simple = 'When you discover a useful technique or piece of knowledge at work, what do you usually do with it?',
  option_1_simple = 'I write it down and proactively share it with anyone who might benefit',
  option_2_simple = 'I share it when someone asks or when it seems relevant',
  option_3_simple = 'I use it myself and mention it informally if it seems useful to someone nearby',
  option_4_simple = 'I keep it in my personal notes and apply it to my own work',
  option_5_simple = 'I rarely document what I learn in a way I could share with others',
  question_text_hi = 'जब आप काम पर एक उपयोगी technique या knowledge discover करते हैं, तो आप आमतौर पर उसके साथ क्या करते हैं?',
  option_1_hi = 'मैं इसे लिखता हूँ और proactively उन सभी के साथ share करता हूँ जिन्हें फायदा हो सकता है',
  option_2_hi = 'मैं इसे share करता हूँ जब कोई पूछे या जब यह relevant लगे',
  option_3_hi = 'मैं खुद इसे use करता हूँ और informally mention करता हूँ अगर nearby किसी के लिए useful लगे',
  option_4_hi = 'मैं इसे अपने personal notes में रखता हूँ और अपने काम में apply करता हूँ',
  option_5_hi = 'मैं शायद ही कभी जो सीखता हूँ उसे ऐसे document करता हूँ जिसे दूसरों से share किया जा सके'
WHERE question_number = 26;

-- Q27
UPDATE growth_profile_questions SET
  question_text_simple = 'When there is tension between two colleagues, which is more like your natural response?',
  option_1_simple = 'I tend to get involved directly to help resolve it, even if it is uncomfortable',
  option_2_simple = 'I tend to give them space and let them work it out unless they ask me to get involved',
  question_text_hi = 'जब दो colleagues के बीच tension हो, तो आपकी natural reaction कौन सी है?',
  option_1_hi = 'मैं directly involve होकर इसे resolve करने में मदद करता हूँ, चाहे uncomfortable हो',
  option_2_hi = 'मैं उन्हें space देता हूँ और उन्हें खुद सुलझाने देता हूँ, जब तक वे मुझे involve न करें'
WHERE question_number = 27;

-- Q28
UPDATE growth_profile_questions SET
  question_text_simple = 'You are asked to lead a project involving four departments, each with different priorities. What is your first step?',
  option_1_simple = 'Map each department''s priorities and find real areas of agreement before any kickoff',
  option_2_simple = 'Set up a shared kickoff meeting, align on a common goal, and agree on how decisions will be made',
  option_3_simple = 'Find the senior person in each department and get their buy-in individually',
  option_4_simple = 'Start with the most critical work and manage cross-department dependencies as they come up',
  option_5_simple = 'Assign a coordination person in each department to manage their team''s involvement',
  question_text_hi = 'आपको चार departments को involve करने वाले project की lead करने के लिए कहा जाता है, हर एक की अलग priorities हैं। आपका पहला कदम क्या है?',
  option_1_hi = 'किसी भी kickoff से पहले हर department की priorities map करना और real agreement के areas ढूंढना',
  option_2_hi = 'एक shared kickoff meeting set up करना, common goal पर align करना, और decisions कैसे होंगे इस पर सहमत होना',
  option_3_hi = 'हर department में senior व्यक्ति ढूंढना और individually उनका buy-in लेना',
  option_4_hi = 'सबसे critical काम से शुरू करना और cross-department dependencies को जैसे-जैसे आएं manage करना',
  option_5_hi = 'हर department में एक coordination person assign करना जो उनकी team की involvement manage करे'
WHERE question_number = 28;

-- Q29
UPDATE growth_profile_questions SET
  question_text_simple = 'After an important team meeting, how do you usually make sure everyone knows what they need to do next?',
  option_1_simple = 'I send a written summary of decisions and actions to all attendees',
  option_2_simple = 'I verbally confirm the key decisions before the meeting ends',
  option_3_simple = 'I follow up with the people whose actions depend on mine',
  option_4_simple = 'I trust that everyone noted down what they need to do',
  option_5_simple = 'I check in a day or two later if I notice things are not moving',
  question_text_hi = 'एक important team meeting के बाद, आप आमतौर पर कैसे सुनिश्चित करते हैं कि सभी को पता है कि आगे क्या करना है?',
  option_1_hi = 'मैं सभी attendees को decisions और actions का written summary भेजता हूँ',
  option_2_hi = 'मैं meeting खत्म होने से पहले key decisions verbally confirm करता हूँ',
  option_3_hi = 'मैं उन लोगों के साथ follow up करता हूँ जिनके actions मेरे actions पर depend करते हैं',
  option_4_hi = 'मुझे भरोसा है कि सभी ने अपनी जरूरी बातें नोट कर ली हैं',
  option_5_hi = 'अगर मुझे लगे कि चीजें आगे नहीं बढ़ रहीं तो मैं एक-दो दिन बाद check in करता हूँ'
WHERE question_number = 29;

-- Q30 (social desirability trap)
UPDATE growth_profile_questions SET
  question_text_simple = 'Thinking honestly about your relationships with colleagues, which is most true for you?',
  option_1_simple = 'There have been colleagues I found genuinely difficult to work with over a long period',
  option_2_simple = 'I have had one or two working relationships that required significant effort to manage',
  option_3_simple = 'Most of my working relationships are positive, though some take more energy than others',
  option_4_simple = 'I generally get along well with colleagues and rarely find relationships difficult',
  option_5_simple = 'I have never had any meaningful difficulty working with any colleague',
  question_text_hi = 'Colleagues के साथ अपने relationships के बारे में ईमानदारी से सोचते हुए, इनमें से कौन सा आपके लिए सबसे सच है?',
  option_1_hi = 'ऐसे colleagues रहे हैं जिनके साथ मुझे लंबे समय तक काम करना genuinely मुश्किल लगा',
  option_2_hi = 'एक-दो working relationships थे जिन्हें manage करने के लिए significant effort लगी',
  option_3_hi = 'मेरी ज्यादातर working relationships positive हैं, हालाँकि कुछ में ज्यादा energy लगती है',
  option_4_hi = 'मैं आमतौर पर colleagues के साथ अच्छी तरह मिलता हूँ और शायद ही कभी relationships मुश्किल लगती हैं',
  option_5_hi = 'किसी भी colleague के साथ काम करने में मुझे कभी कोई meaningful कठिनाई नहीं हुई'
WHERE question_number = 30;

-- Q31
UPDATE growth_profile_questions SET
  question_text_simple = 'You are managing three projects when a fourth urgent one is added. How does this usually affect your output?',
  option_1_simple = 'I reprioritise clearly, explain the trade-offs to everyone, and keep quality up across all projects',
  option_2_simple = 'I manage but one project usually gets less attention than the others',
  option_3_simple = 'I work longer hours to keep all commitments',
  option_4_simple = 'Quality drops on at least one project but I meet all deadlines',
  option_5_simple = 'I push back on the fourth project until I have capacity',
  question_text_hi = 'आप तीन projects manage कर रहे हैं जब एक चौथा urgent project add हो जाता है। इसका आमतौर पर आपके output पर क्या असर होता है?',
  option_1_hi = 'मैं clearly reprioritise करता हूँ, सभी को trade-offs समझाता हूँ, और सभी projects में quality बनाए रखता हूँ',
  option_2_hi = 'मैं manage कर लेता हूँ लेकिन एक project को आमतौर पर दूसरों से कम attention मिलती है',
  option_3_hi = 'मैं सभी commitments पूरे करने के लिए ज्यादा घंटे काम करता हूँ',
  option_4_hi = 'कम से कम एक project पर quality गिरती है लेकिन मैं सभी deadlines meet करता हूँ',
  option_5_hi = 'मैं चौथे project पर तब तक push back करता हूँ जब तक मेरे पास capacity न हो'
WHERE question_number = 31;

-- Q32
UPDATE growth_profile_questions SET
  question_text_simple = 'Think of the last big setback you had at work. How long did it affect your attitude and energy?',
  option_1_simple = 'It affected me for several weeks and I found it hard to refocus',
  option_2_simple = 'It weighed on me for about a week before I could fully move on',
  option_3_simple = 'It bothered me for a couple of days, then I refocused',
  option_4_simple = 'I recovered quickly — within a day I was back to my normal pace',
  option_5_simple = 'It barely affected me — I treated it as useful information and moved on immediately',
  question_text_hi = 'काम पर हुई आखिरी बड़ी setback याद करें। इसने आपके attitude और energy को कितने समय तक affect किया?',
  option_1_hi = 'इसने कई हफ्तों तक मुझे affect किया और मुझे refocus करना मुश्किल लगा',
  option_2_hi = 'यह लगभग एक हफ्ते तक मुझ पर भारी रहा, फिर मैं आगे बढ़ पाया',
  option_3_hi = 'यह दो-तीन दिनों तक परेशान करता रहा, फिर मैंने refocus किया',
  option_4_hi = 'मैं जल्दी recover कर गया — एक दिन के अंदर मैं अपनी normal pace पर वापस था',
  option_5_hi = 'इसने मुझे बहुत कम affect किया — मैंने इसे useful information की तरह लिया और तुरंत आगे बढ़ गया'
WHERE question_number = 32;

-- Q33
UPDATE growth_profile_questions SET
  question_text_simple = 'After receiving critical feedback on work you put real effort into, what usually happens for you?',
  option_1_simple = 'I feel defensive at first but work through it over several days',
  option_2_simple = 'I feel disappointed but actively try to understand and use the feedback',
  option_3_simple = 'I process it quickly and identify two or three changes I can make',
  option_4_simple = 'I feel motivated by it — this is exactly the kind of input that helps me improve',
  option_5_simple = 'I rarely have a strong emotional reaction — I treat it as useful data',
  question_text_hi = 'जिस काम में आपने real effort लगाई उस पर critical feedback मिलने के बाद, आमतौर पर आपके साथ क्या होता है?',
  option_1_hi = 'पहले defensive महसूस करता हूँ लेकिन कई दिनों में इससे बाहर आता हूँ',
  option_2_hi = 'निराश महसूस करता हूँ लेकिन actively feedback समझने और use करने की कोशिश करता हूँ',
  option_3_hi = 'मैं जल्दी process करता हूँ और दो-तीन बदलाव identify करता हूँ जो कर सकता हूँ',
  option_4_hi = 'यह मुझे motivate करता है — यही वह input है जो मुझे improve करने में help करती है',
  option_5_hi = 'मेरी शायद ही कभी strong emotional reaction होती है — मैं इसे useful data की तरह लेता हूँ'
WHERE question_number = 33;

-- Q34
UPDATE growth_profile_questions SET
  question_text_simple = 'Your company announces it is facing its toughest commercial year. Your team is under pressure. What is your outlook over the next month?',
  option_1_simple = 'I acknowledge the difficulty, focus on what I can control, and maintain my output',
  option_2_simple = 'I feel anxious about job security but manage to keep working effectively',
  option_3_simple = 'I find it motivating — this is when people show what they are made of',
  option_4_simple = 'I am cautious and wait to see how things develop before changing how I work',
  option_5_simple = 'I am concerned but try not to let it affect my team''s morale',
  question_text_hi = 'आपकी company announce करती है कि यह उसका सबसे कठिन commercial year है। आपकी team pressure में है। अगले महीने आपका outlook क्या है?',
  option_1_hi = 'मैं कठिनाई को acknowledge करता हूँ, जो मेरे control में है उस पर focus करता हूँ, और अपना output बनाए रखता हूँ',
  option_2_hi = 'मुझे job security की चिंता होती है लेकिन effectively काम करता रहता हूँ',
  option_3_hi = 'मुझे motivating लगता है — यही वह समय है जब लोग दिखाते हैं कि वे क्या हैं',
  option_4_hi = 'मैं cautious हूँ और काम करने का तरीका बदलने से पहले देखता हूँ कि चीजें कैसे develop होती हैं',
  option_5_hi = 'मुझे चिंता होती है लेकिन team के morale पर असर न पड़ने देने की कोशिश करता हूँ'
WHERE question_number = 34;

-- Q35
UPDATE growth_profile_questions SET
  question_text_simple = 'Which of these two statements is more like how you experience high-pressure periods at work?',
  option_1_simple = 'Pressure sharpens my focus and I often do my best work under tight deadlines',
  option_2_simple = 'Pressure is a normal part of work and I manage it by staying disciplined about priorities',
  question_text_hi = 'काम पर high-pressure periods के बारे में इनमें से कौन सा आपके जैसा है?',
  option_1_hi = 'Pressure मेरा focus बढ़ाता है और मैं अक्सर tight deadlines में अपना best काम करता हूँ',
  option_2_hi = 'Pressure काम का एक normal हिस्सा है और मैं priorities के बारे में disciplined रहकर इसे manage करता हूँ'
WHERE question_number = 35;

-- Q36
UPDATE growth_profile_questions SET
  question_text_simple = 'How would your closest colleague describe your behaviour across a typical month that has both good and difficult weeks?',
  option_1_simple = 'Noticeably different — they would see real highs and lows in me',
  option_2_simple = 'Slightly variable — my mood is readable but I manage it',
  option_3_simple = 'Generally consistent — they see some variation but I don''t bring stress to the team',
  option_4_simple = 'Very consistent — people rarely know if I am having a difficult week',
  option_5_simple = 'Remarkably steady — colleagues sometimes ask how I stay so even',
  question_text_hi = 'आपका सबसे करीबी colleague एक ऐसे typical month में जिसमें अच्छे और मुश्किल दोनों हफ्ते हों, आपके behaviour को कैसे describe करेगा?',
  option_1_hi = 'काफी अलग — वे मुझमें real highs और lows देखेंगे',
  option_2_hi = 'थोड़ा variable — मेरा mood readable है लेकिन मैं इसे manage करता हूँ',
  option_3_hi = 'आमतौर पर consistent — वे कुछ variation देखते हैं लेकिन मैं team में stress नहीं लाता',
  option_4_hi = 'बहुत consistent — लोगों को शायद ही पता चलता है कि मेरा मुश्किल हफ्ता था',
  option_5_hi = 'असाधारण रूप से steady — colleagues कभी-कभी पूछते हैं कि मैं इतना even कैसे रहता हूँ'
WHERE question_number = 36;

-- Q37
UPDATE growth_profile_questions SET
  question_text_simple = 'Which of these two statements is more like how you relate to past mistakes?',
  option_1_simple = 'I analyse what went wrong, take the lesson, and move on relatively quickly',
  option_2_simple = 'I reflect carefully on what went wrong and make sure I fully understand it before moving on',
  question_text_hi = 'पिछली गलतियों के बारे में इनमें से कौन सा आपके जैसा है?',
  option_1_hi = 'मैं analyse करता हूँ क्या गलत हुआ, lesson लेता हूँ, और relatively जल्दी आगे बढ़ जाता हूँ',
  option_2_hi = 'मैं ध्यान से reflect करता हूँ क्या गलत हुआ और आगे बढ़ने से पहले पूरी तरह समझ लेता हूँ'
WHERE question_number = 37;

-- Q38
UPDATE growth_profile_questions SET
  question_text_simple = 'When you hit a big obstacle on a project, what is your most common first reaction?',
  option_1_simple = 'I feel frustrated but take time to think through solutions',
  option_2_simple = 'I quickly assess the obstacle and start thinking of options',
  option_3_simple = 'I immediately involve others to bring more perspectives to the problem',
  option_4_simple = 'I communicate the obstacle upward and look for a decision on how to proceed',
  option_5_simple = 'I look for what I can keep working on while the obstacle is being resolved',
  question_text_hi = 'जब आपको project पर एक बड़ी बाधा आती है, तो आपकी सबसे आम पहली प्रतिक्रिया क्या है?',
  option_1_hi = 'मुझे frustration होती है लेकिन मैं solutions के बारे में सोचने में समय लगाता हूँ',
  option_2_hi = 'मैं जल्दी बाधा assess करता हूँ और options के बारे में सोचना शुरू करता हूँ',
  option_3_hi = 'मैं तुरंत दूसरों को involve करता हूँ ताकि problem पर ज्यादा perspectives मिलें',
  option_4_hi = 'मैं बाधा को ऊपर communicate करता हूँ और आगे कैसे बढ़ना है इस पर decision ढूंढता हूँ',
  option_5_hi = 'मैं देखता हूँ कि बाधा resolve होने के दौरान मैं किस पर काम करता रह सकता हूँ'
WHERE question_number = 38;

-- Q39
UPDATE growth_profile_questions SET
  question_text_simple = 'Your team unexpectedly loses two members, temporarily doubling your workload. Over the next month, what is the most realistic outcome for you?',
  option_1_simple = 'I manage it — I work harder, reprioritise ruthlessly, and deliver what matters most',
  option_2_simple = 'I absorb most of the extra work but quality suffers in some areas',
  option_3_simple = 'I maintain quality but need to extend some deadlines',
  option_4_simple = 'I flag the capacity issue early, agree on reduced scope, and deliver that well',
  option_5_simple = 'I struggle significantly and need management to help manage expectations',
  question_text_hi = 'आपकी team अचानक दो members खो देती है, जिससे आपका workload temporarily double हो जाता है। अगले महीने में आपके लिए सबसे realistic outcome क्या है?',
  option_1_hi = 'मैं manage कर लेता हूँ — ज्यादा मेहनत करता हूँ, ruthlessly reprioritise करता हूँ, और जो सबसे जरूरी है वो deliver करता हूँ',
  option_2_hi = 'मैं ज्यादातर extra काम absorb करता हूँ लेकिन कुछ areas में quality suffer करती है',
  option_3_hi = 'मैं quality बनाए रखता हूँ लेकिन कुछ deadlines extend करनी पड़ती हैं',
  option_4_hi = 'मैं capacity issue जल्दी flag करता हूँ, reduced scope पर सहमत होता हूँ, और उसे अच्छी तरह deliver करता हूँ',
  option_5_hi = 'मुझे काफी struggle होती है और expectations manage करने के लिए management की मदद चाहिए'
WHERE question_number = 39;

-- Q40 (social desirability trap)
UPDATE growth_profile_questions SET
  question_text_simple = 'Thinking honestly about how you handle stress, which is most true for you?',
  option_1_simple = 'Certain types of work pressure reliably affect my mood or performance',
  option_2_simple = 'I have specific stress triggers that I am aware of and actively manage',
  option_3_simple = 'I manage stress well overall, though some situations are genuinely hard',
  option_4_simple = 'I rarely feel meaningfully stressed by work demands',
  option_5_simple = 'I have never felt that work stress affected my performance or relationships',
  question_text_hi = 'Stress handle करने के तरीके के बारे में ईमानदारी से सोचते हुए, इनमें से कौन सा आपके लिए सबसे सच है?',
  option_1_hi = 'कुछ certain types के work pressure मेरे mood या performance को reliably affect करते हैं',
  option_2_hi = 'मेरे specific stress triggers हैं जिनके बारे में मुझे पता है और जिन्हें मैं actively manage करता हूँ',
  option_3_hi = 'मैं overall stress अच्छी तरह manage करता हूँ, हालाँकि कुछ situations genuinely मुश्किल होती हैं',
  option_4_hi = 'मुझे work demands से शायद ही कभी meaningfully stress होता है',
  option_5_hi = 'मुझे कभी नहीं लगा कि work stress ने मेरी performance या relationships को affect किया'
WHERE question_number = 40;

-- Q41
UPDATE growth_profile_questions SET
  question_text_simple = 'Which of these two statements is more like what you genuinely believe?',
  option_1_simple = 'With enough effort and the right approach, most skills can be developed significantly',
  option_2_simple = 'Some people are naturally better suited to certain areas and effort has limits',
  question_text_hi = 'इनमें से कौन सा आप genuinely मानते हैं?',
  option_1_hi = 'पर्याप्त effort और सही approach से, ज्यादातर skills को significantly develop किया जा सकता है',
  option_2_hi = 'कुछ लोग naturally कुछ areas के लिए ज्यादा suited होते हैं और effort की limits होती हैं'
WHERE question_number = 41;

-- Q42
UPDATE growth_profile_questions SET
  question_text_simple = 'Outside of your direct job requirements, how would you describe your engagement with learning in the past year?',
  option_1_simple = 'I have done little beyond what my role required',
  option_2_simple = 'I have done some reading or occasional learning when an interesting topic came up',
  option_3_simple = 'I have completed one or two structured learning activities such as a course or certification',
  option_4_simple = 'I have a consistent personal development routine — reading, courses, or learning communities',
  option_5_simple = 'I invest significant time in learning beyond my role and can point to specific outcomes',
  question_text_hi = 'अपनी direct job requirements से परे, पिछले साल learning के साथ अपने engagement को कैसे describe करेंगे?',
  option_1_hi = 'मैंने अपनी role की जरूरत से ज्यादा बहुत कम किया',
  option_2_hi = 'मैंने कुछ reading या occasional learning की जब कोई interesting topic सामने आया',
  option_3_hi = 'मैंने एक-दो structured learning activities की जैसे course या certification',
  option_4_hi = 'मेरी एक consistent personal development routine है — reading, courses, या learning communities',
  option_5_hi = 'मैं अपनी role से परे learning में significant समय invest करता हूँ और specific outcomes बता सकता हूँ'
WHERE question_number = 42;

-- Q43
UPDATE growth_profile_questions SET
  question_text_simple = 'You receive detailed critical feedback on a piece of work you are proud of. The feedback is genuinely helpful. Which is most like your reaction?',
  option_1_simple = 'I feel briefly defensive, then genuinely engage with the content',
  option_2_simple = 'I appreciate it and immediately ask follow-up questions to understand the details',
  option_3_simple = 'I listen carefully and then privately assess whether it is accurate',
  option_4_simple = 'I feel motivated by it — this is exactly the kind of input that helps me improve',
  option_5_simple = 'I feel uncomfortable at first but make a point of acting on the specific feedback',
  question_text_hi = 'आपको उस काम पर detailed critical feedback मिलती है जिस पर आपको गर्व है। Feedback genuinely helpful है। आपकी प्रतिक्रिया कौन सी है?',
  option_1_hi = 'मैं briefly defensive feel करता हूँ, फिर genuinely content से engage करता हूँ',
  option_2_hi = 'मैं इसकी appreciate करता हूँ और तुरंत details समझने के लिए follow-up questions पूछता हूँ',
  option_3_hi = 'मैं ध्यान से सुनता हूँ और फिर privately assess करता हूँ कि यह accurate है या नहीं',
  option_4_hi = 'यह मुझे motivate करता है — यही वह input है जो मुझे improve करने में help करती है',
  option_5_hi = 'पहले uncomfortable feel करता हूँ लेकिन specific feedback पर act करना जरूरी समझता हूँ'
WHERE question_number = 43;

-- Q44
UPDATE growth_profile_questions SET
  question_text_simple = 'When you have been doing a routine task the same way for several months, what do you usually do?',
  option_1_simple = 'I keep doing it the same way — if it works well, there is no reason to change it',
  option_2_simple = 'I sometimes wonder if there is a better way but rarely act on it',
  option_3_simple = 'I periodically review whether it can be improved and sometimes make small changes',
  option_4_simple = 'I regularly look for improvements and have changed my approach multiple times',
  option_5_simple = 'I almost always find a way to refine or automate routine tasks',
  question_text_hi = 'जब आप कई महीनों से एक routine task को उसी तरह करते आ रहे हों, तो आप आमतौर पर क्या करते हैं?',
  option_1_hi = 'मैं उसे उसी तरह करता रहता हूँ — अगर अच्छी तरह काम कर रहा है तो बदलने की कोई वजह नहीं',
  option_2_hi = 'कभी-कभी सोचता हूँ कि कोई बेहतर तरीका है लेकिन शायद ही कभी उस पर act करता हूँ',
  option_3_hi = 'मैं periodically review करता हूँ कि improve हो सकता है या नहीं और कभी-कभी छोटे बदलाव करता हूँ',
  option_4_hi = 'मैं regularly improvements ढूंढता हूँ और कई बार अपना approach बदल चुका हूँ',
  option_5_hi = 'मैं लगभग हमेशा routine tasks को refine या automate करने का तरीका ढूंढ लेता हूँ'
WHERE question_number = 44;

-- Q45
UPDATE growth_profile_questions SET
  question_text_simple = 'You receive honest feedback that you are weaker than your peers in an area that matters for your career. What is your thinking over the following week?',
  option_1_simple = 'I feel unsettled at first but develop a specific plan to close the gap',
  option_2_simple = 'I am motivated to address it and look for resources or a mentor with that skill',
  option_3_simple = 'I assess whether it is genuinely a priority for my career before deciding how to respond',
  option_4_simple = 'I reflect on whether the feedback is accurate before deciding how to act',
  option_5_simple = 'I feel energised by it — development gaps are opportunities',
  question_text_hi = 'आपको honest feedback मिलती है कि आप अपने career के लिए एक important area में peers से कमजोर हैं। अगले हफ्ते आपकी सोच क्या है?',
  option_1_hi = 'पहले unsettled feel करता हूँ लेकिन gap close करने के लिए specific plan develop करता हूँ',
  option_2_hi = 'मैं इसे address करने के लिए motivated हूँ और उस skill के resources या mentor ढूंढता हूँ',
  option_3_hi = 'मैं assess करता हूँ कि यह genuinely मेरे career की priority है या नहीं, फिर decide करता हूँ',
  option_4_hi = 'मैं act करने से पहले reflect करता हूँ कि feedback accurate है या नहीं',
  option_5_hi = 'यह मुझे energise करता है — development gaps opportunities हैं'
WHERE question_number = 45;

-- Q46
UPDATE growth_profile_questions SET
  question_text_simple = 'Which of these two statements is more like how you typically behave?',
  option_1_simple = 'I go deep in my area of expertise and develop real mastery',
  option_2_simple = 'I go broad across multiple areas and connect ideas from different fields',
  question_text_hi = 'इनमें से कौन सा आपके typical behaviour जैसा है?',
  option_1_hi = 'मैं अपनी expertise के area में deep जाता हूँ और real mastery develop करता हूँ',
  option_2_hi = 'मैं कई areas में broad जाता हूँ और अलग-अलग fields के ideas को connect करता हूँ'
WHERE question_number = 46;

-- Q47
UPDATE growth_profile_questions SET
  question_text_simple = 'How often do you proactively ask for feedback on your work from colleagues or managers?',
  option_1_simple = 'Rarely — I wait for formal review cycles',
  option_2_simple = 'Occasionally — when I feel uncertain about something',
  option_3_simple = 'Regularly — after most significant pieces of work',
  option_4_simple = 'Frequently — feedback is part of how I calibrate my work',
  option_5_simple = 'Consistently and systematically — I have my own practice for seeking feedback',
  question_text_hi = 'आप colleagues या managers से अपने काम पर feedback कितनी बार proactively माँगते हैं?',
  option_1_hi = 'कभी-कभी ही — मैं formal review cycles का इंतजार करता हूँ',
  option_2_hi = 'कभी-कभी — जब मुझे किसी चीज के बारे में uncertainty हो',
  option_3_hi = 'नियमित रूप से — ज्यादातर significant काम के बाद',
  option_4_hi = 'अक्सर — feedback मेरे काम को calibrate करने का हिस्सा है',
  option_5_hi = 'Consistently और systematically — feedback लेने के लिए मेरी अपनी practice है'
WHERE question_number = 47;

-- Q48
UPDATE growth_profile_questions SET
  question_text_simple = 'Which of these two statements is more like how you approach your work?',
  option_1_simple = 'I am always looking for what could be done better, even when things are working',
  option_2_simple = 'I focus on executing the current approach well before exploring changes',
  question_text_hi = 'इनमें से कौन सा आपके काम के approach जैसा है?',
  option_1_hi = 'मैं हमेशा देखता हूँ कि क्या बेहतर किया जा सकता है, चाहे चीजें काम कर रही हों',
  option_2_hi = 'मैं बदलाव explore करने से पहले current approach को अच्छी तरह execute करने पर focus करता हूँ'
WHERE question_number = 48;

-- Q49
UPDATE growth_profile_questions SET
  question_text_simple = 'You put significant effort into a project that ultimately fails to achieve its goals despite your best work. Which is most like your experience?',
  option_1_simple = 'I feel disappointed but find it easier to move on when I can identify what I learned',
  option_2_simple = 'I am frustrated mainly when the failure was avoidable, but I process it and continue',
  option_3_simple = 'I treat it as a data point — understanding the failure feels more important than the emotion',
  option_4_simple = 'I feel resilient about it because I knew outcome uncertainty was part of taking on the work',
  option_5_simple = 'I am briefly disheartened but recover quickly when I focus on the next challenge',
  question_text_hi = 'आप एक project में significant effort लगाते हैं जो ultimately अपने goals achieve नहीं करता, आपके best work के बावजूद। आपका अनुभव कैसा है?',
  option_1_hi = 'मुझे disappointment होती है लेकिन आगे बढ़ना आसान हो जाता है जब मैं पहचान सकूँ कि क्या सीखा',
  option_2_hi = 'मैं mainly frustrated होता हूँ जब failure avoidable था, लेकिन process करके continue करता हूँ',
  option_3_hi = 'मैं इसे एक data point की तरह लेता हूँ — failure समझना emotion से ज्यादा important लगता है',
  option_4_hi = 'मैं इसके बारे में resilient feel करता हूँ क्योंकि मुझे पता था outcome uncertainty काम का हिस्सा है',
  option_5_hi = 'मैं briefly disheartened होता हूँ लेकिन जब next challenge पर focus करता हूँ तो जल्दी recover करता हूँ'
WHERE question_number = 49;

-- Q50 (social desirability trap)
UPDATE growth_profile_questions SET
  question_text_simple = 'Thinking honestly about your relationship with learning and development, which is most accurate?',
  option_1_simple = 'There are topics or skills I know I should develop but have not prioritised',
  option_2_simple = 'I have one or two clear development areas I have been slower to address than I should',
  option_3_simple = 'I am generally proactive about development, though I don''t always follow through consistently',
  option_4_simple = 'I am highly consistent about my own development and rarely delay what I know I should do',
  option_5_simple = 'I have never knowingly put off a development activity that was important for my career',
  question_text_hi = 'Learning और development के साथ अपने relationship के बारे में ईमानदारी से सोचते हुए, इनमें से कौन सा सबसे accurate है?',
  option_1_hi = 'ऐसे topics या skills हैं जिन्हें मैं जानता हूँ develop करना चाहिए लेकिन prioritise नहीं किया',
  option_2_hi = 'एक-दो clear development areas हैं जिन्हें address करने में मुझे जितना चाहिए था उससे ज्यादा समय लग रहा है',
  option_3_hi = 'मैं generally development के बारे में proactive हूँ, हालाँकि हमेशा consistently follow through नहीं करता',
  option_4_hi = 'मैं अपने development के बारे में highly consistent हूँ और शायद ही कभी वह delay करता हूँ जो करना चाहिए',
  option_5_hi = 'मैंने कभी knowingly कोई development activity नहीं टाली जो मेरे career के लिए important थी'
WHERE question_number = 50;
