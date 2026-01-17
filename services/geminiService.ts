
import { GoogleGenAI, Type, Part } from "@google/genai";
import { GEMINI_API_KEY } from "./config";

// --- RE-USED INTERFACES (now part of the Course structure) ---
export interface QuizQuestion {
  question: string;
  options: string[];
  answer: string;
  imageUrl?: string; // Optional image for the question
}

export interface ArticleSuggestion {
  title: string;
  url: string;
  concept: string;
}

export interface VideoSuggestion {
  title: string;
  url: string;
  channel: string;
}

export interface CaseStudySuggestion {
  title: string;
  description: string;
}

export interface StudySuggestions {
  articles: ArticleSuggestion[];
  videos: VideoSuggestion[];
  caseStudies: CaseStudySuggestion[];
}

// --- NEW COURSE INTERFACES ---
export interface Quiz {
  quizId: string;
  questions: QuizQuestion[];
  status: 'not-started' | 'completed';
  score?: number; // Score out of total questions
}

export interface Level {
  levelId: string;
  levelTitle: string;
  status: 'not-started' | 'in-progress' | 'completed';
  summary: string;
  quizzes: Quiz[];
  references: StudySuggestions;
  imageUrl?: string; // Optional image for the level summary
}

export interface QuizAttempt {
  attemptId: string;
  quizId: string;
  levelId: string;
  levelTitle: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  timestamp: number;
}


export interface Course {
  courseId: string;
  courseTitle: string;
  progress: number;
  difficulty: 'Beginner' | 'Advanced';
  levels: Level[];
  history: QuizAttempt[];
  nextSteps: {
    relatedTopics: string[];
    advancedMaterial: CaseStudySuggestion[];
  };
}

/**
 * Interface for internal level generation logic
 */
interface LevelContent {
  summary: string;
  imageUrl?: string;
  quiz: QuizQuestion[];
  references: StudySuggestions;
}

/**
 * Interface for manual level input structure
 */
export interface ManualLevel {
  id: string;
  title: string;
}

/**
 * Helper to get a fresh instance of the AI client.
 * Uses the API key provided in config.ts.
 */
const getAiClient = () => {
  return new GoogleGenAI({ apiKey: GEMINI_API_KEY });
};

// Helper to convert base64 data URLs to Gemini Parts
const fileToGenerativePart = (dataUrl: string): Part => {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,(.*)$/);
  if (!match) {
    throw new Error('Invalid data URL format');
  }
  return {
    inlineData: {
      mimeType: match[1],
      data: match[2],
    },
  };
};

/**
 * Generates a full, multi-level course from a given text automatically.
 * @param text The source text from the PDF.
 * @param images An array of base64 image data URLs from the PDF.
 * @param difficulty The desired difficulty for the course content.
 * @returns A promise that resolves with the structured Course object.
 */
export async function generateCourse(text: string, images: string[], difficulty: 'Beginner' | 'Advanced'): Promise<Course> {
  const ai = getAiClient();
  const prompt = `
      You are an AI education assistant. Based on the provided academic text and accompanying images (graphs, diagrams, etc.), create a comprehensive learning course.
      The target audience is at a ${difficulty} level.

      Your task is to:
      1.  Propose a course title using the format: "[Broad Subject] - [Specific Topic]".
      2.  Divide the content into 3 logical, progressively difficult levels. For each level, provide:
          a. A concise, descriptive title.
          b. A detailed summary of the key concepts for that level.
          c. A multiple-choice quiz with 3 questions. Each question must have 4 options and a correct answer.
          d. Suggestions for reference material: 2 online articles and 1 educational video.
      3. For EACH level, identify the single most relevant image from the provided set to illustrate the summary. Provide its 0-based index. If no image is relevant, use -1.
      4. For EACH quiz question, if it specifically refers to one of the images, provide that image's 0-based index. Otherwise, omit the field.
      5.  Suggest next steps for learning: 3 related topics and 1 advanced material suggestion.

      The response must be a single, valid JSON object that strictly adheres to the provided schema.

      Text: """${text}"""
  `;
  
  const caseStudySchema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      description: { type: Type.STRING }
    },
    required: ["title", "description"]
  };

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      courseTitle: { type: Type.STRING },
      levels: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            levelTitle: { type: Type.STRING },
            summary: { type: Type.STRING },
            imageIndex: { type: Type.NUMBER, description: "0-based index of the most relevant image for this level's summary, or -1 if none." },
            quiz: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  answer: { type: Type.STRING },
                  imageIndex: { type: Type.NUMBER, description: "0-based index of an image this question refers to. Omit if not applicable." }
                },
                required: ["question", "options", "answer"]
              }
            },
            references: {
              type: Type.OBJECT,
              properties: {
                articles: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, url: { type: Type.STRING }, concept: { type: Type.STRING } }, required: ["title", "url", "concept"] } },
                videos: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, url: { type: Type.STRING }, channel: { type: Type.STRING } }, required: ["title", "url", "channel"] } },
              },
              required: ["articles", "videos"]
            }
          },
          required: ["levelTitle", "summary", "quiz", "references", "imageIndex"]
        }
      },
      nextSteps: {
        type: Type.OBJECT,
        properties: {
          relatedTopics: { type: Type.ARRAY, items: { type: Type.STRING } },
          advancedMaterial: { type: Type.ARRAY, items: caseStudySchema }
        },
        required: ["relatedTopics", "advancedMaterial"]
      }
    },
    required: ["courseTitle", "levels", "nextSteps"]
  };
  
  try {
    const contents: Part[] = [{ text: prompt }];
    if (images.length > 0) {
      images.forEach(img => contents.push(fileToGenerativePart(img)));
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: { parts: contents },
      config: { responseMimeType: "application/json", responseSchema: responseSchema },
    });
    const jsonString = response.text.trim();
    const parsedResponse = JSON.parse(jsonString);

    const course: Course = {
      courseId: `crs-${Date.now()}`,
      courseTitle: parsedResponse.courseTitle,
      progress: 0,
      difficulty: difficulty,
      history: [],
      levels: parsedResponse.levels.map((level: any, index: number) => {
        const quizQuestions: QuizQuestion[] = level.quiz.map((q: any) => ({
          question: q.question,
          options: q.options,
          answer: q.answer,
          imageUrl: (q.imageIndex >= 0 && q.imageIndex < images.length) ? images[q.imageIndex] : undefined,
        }));

        return {
          levelId: `lvl-${Date.now()}-${index}`,
          status: 'not-started',
          levelTitle: level.levelTitle,
          summary: level.summary,
          imageUrl: (level.imageIndex >= 0 && level.imageIndex < images.length) ? images[level.imageIndex] : undefined,
          quizzes: [{
            quizId: `quiz-${Date.now()}-${index}`,
            questions: quizQuestions,
            status: 'not-started',
          }],
          references: { ...level.references, caseStudies: [] }
        };
      }),
      nextSteps: parsedResponse.nextSteps
    };

    return course;

  } catch (error) {
    console.error("Error generating course:", error);
    throw new Error("Failed to generate the course. The AI may have had trouble with the document's content or format. Please try another PDF.");
  }
}

/**
 * Generates a new quiz for a given level's summary.
 */
export async function generateNewQuiz(levelSummary: string, levelTitle: string): Promise<QuizQuestion[]> {
  const ai = getAiClient();
  const prompt = `
    You are an AI quiz generator. Your task is to create a new set of quiz questions based on the provided text summary for a course level.
    The course level is titled: "${levelTitle}".
    The summary is: """${levelSummary}"""

    Please generate a multiple-choice quiz with 3 questions.
    - Each question must have 4 options.
    - One option must be the correct answer.
    - The questions should be different from a typical first-pass quiz and test a deeper understanding of the summary.

    The response must be a single, valid JSON array of objects that strictly adheres to the provided schema. Do not include any markdown formatting.
  `;
  
  const quizSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        question: { type: Type.STRING },
        options: { type: Type.ARRAY, items: { type: Type.STRING } },
        answer: { type: Type.STRING }
      },
      required: ["question", "options", "answer"]
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: quizSchema },
    });
    const jsonString = response.text.trim();
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Error generating new quiz:", error);
    throw new Error("Failed to generate a new quiz. The AI might be temporarily unavailable.");
  }
}

/**
 * Generates a world trivia quiz.
 */
export async function generateWorldQuiz(country: string, category: string): Promise<QuizQuestion[]> {
  const ai = getAiClient();
  const prompt = `
    You are a quiz generation expert. Create a 5-question multiple-choice quiz about the ${category} of ${country}.
    The questions should be interesting and challenging for a general audience.
    Each question must have 4 options and a single correct answer.
    Respond with ONLY a valid JSON array of objects, where each object has keys 'question', 'options', and 'answer'. Do not include markdown formatting.
  `;

  const quizSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        question: { type: Type.STRING },
        options: { type: Type.ARRAY, items: { type: Type.STRING } },
        answer: { type: Type.STRING }
      },
      required: ["question", "options", "answer"]
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: quizSchema },
    });
    const jsonString = response.text.trim();
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Error generating world quiz:", error);
    throw new Error(`Failed to generate a quiz for ${country} on ${category}. The AI might be temporarily unavailable.`);
  }
}

/**
 * Generates content for a single, pre-defined level title based on the full text.
 */
async function generateLevelContent(fullText: string, allImages: string[], courseTopic: string, levelTitle: string, difficulty: 'Beginner' | 'Advanced'): Promise<LevelContent> {
  const ai = getAiClient();
  const prompt = `
    You are an AI education assistant. The full document's main topic is "${courseTopic}".
    Based on the full text and all images provided below, generate content *specifically for the level titled "${levelTitle}"*.
    The target audience is at a ${difficulty} level.
    
    You must provide:
    1. A detailed summary of the key concepts relevant to this specific level.
    2. A multiple-choice quiz with 3 questions.
    3. Suggestions for reference material: 2 online articles and 1 educational video.
    4. The 0-based index of the SINGLE most relevant image for this level's summary. If none are relevant, use -1.
    5. For each quiz question, if it refers to an image, provide its 0-based index.
    
    The response must be a single, valid JSON object adhering to the schema. Do not include markdown.
    
    Full Text: """${fullText}"""
  `;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING },
      imageIndex: { type: Type.NUMBER },
      quiz: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            answer: { type: Type.STRING },
            imageIndex: { type: Type.NUMBER }
          },
          required: ["question", "options", "answer"]
        }
      },
      references: {
        type: Type.OBJECT,
        properties: {
          articles: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, url: { type: Type.STRING }, concept: { type: Type.STRING } }, required: ["title", "url", "concept"] } },
          videos: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, url: { type: Type.STRING }, channel: { type: Type.STRING } }, required: ["title", "url", "channel"] } },
        },
        required: ["articles", "videos"]
      }
    },
    required: ["summary", "quiz", "references", "imageIndex"]
  };
  
  const contents: Part[] = [{ text: prompt }];
  if (allImages.length > 0) {
    allImages.forEach(img => contents.push(fileToGenerativePart(img)));
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: { parts: contents },
    config: { responseMimeType: "application/json", responseSchema: responseSchema },
  });
  
  const parsed = JSON.parse(response.text.trim());
  return {
    summary: parsed.summary,
    imageUrl: (parsed.imageIndex >= 0 && parsed.imageIndex < allImages.length) ? allImages[parsed.imageIndex] : undefined,
    quiz: parsed.quiz.map((q: any) => ({
      ...q,
      imageUrl: (q.imageIndex >= 0 && q.imageIndex < allImages.length) ? allImages[q.imageIndex] : undefined,
    })),
    references: parsed.references,
  };
}

/**
 * Generates suggestions for next steps based on the course topic.
 */
async function generateNextSteps(courseTopic: string): Promise<Course['nextSteps']> {
  const ai = getAiClient();
  const prompt = `Based on the course topic "${courseTopic}", suggest 3 related topics for further learning and 1 advanced material suggestion (e.g., a case study, research paper, or advanced concept).`;
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      relatedTopics: { type: Type.ARRAY, items: { type: Type.STRING } },
      advancedMaterial: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING }
          },
          required: ["title", "description"]
        }
      }
    },
    required: ["relatedTopics", "advancedMaterial"]
  };
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: responseSchema },
  });
  return JSON.parse(response.text.trim());
}


/**
 * Orchestrates the generation of a course from a user-defined structure.
 */
export async function generateCourseFromManualLevels(
  text: string,
  images: string[],
  courseTitle: string,
  manualLevels: ManualLevel[],
  difficulty: 'Beginner' | 'Advanced',
  setProgressMessage: (message: string) => void
): Promise<Course> {
  try {
    const levelContentPromises = manualLevels.map((level, index) => {
      setProgressMessage(`Generating content for Level ${index + 1}: ${level.title}...`);
      return generateLevelContent(text, images, courseTitle, level.title, difficulty);
    });

    const levelsContent = await Promise.all(levelContentPromises);
    
    setProgressMessage("Figuring out your next steps...");
    const nextSteps = await generateNextSteps(courseTitle);
    
    const finalLevels: Level[] = manualLevels.map((manualLevel, index) => {
      const content = levelsContent[index];
      return {
        levelId: manualLevel.id,
        levelTitle: manualLevel.title,
        status: 'not-started',
        summary: content.summary,
        imageUrl: content.imageUrl,
        quizzes: [{
            quizId: `quiz-${Date.now()}-${index}`,
            questions: content.quiz,
            status: 'not-started',
        }],
        references: {
          ...content.references,
          caseStudies: []
        }
      };
    });

    const course: Course = {
      courseId: `crs-${Date.now()}`,
      courseTitle: courseTitle,
      progress: 0,
      levels: finalLevels,
      difficulty: difficulty,
      history: [],
      nextSteps: nextSteps
    };
    
    return course;

  } catch (error) {
    console.error("Error generating course from manual levels:", error);
    throw new Error("Failed to generate content for the custom course structure. Please check your level titles and try again.");
  }
}

/**
 * Generates additional levels to be added to an existing course.
 */
export async function generateAdditionalLevels(
  courseTitle: string,
  existingLevelTitles: string[],
  newText: string,
  newImages: string[],
  difficulty: 'Beginner' | 'Advanced'
): Promise<Omit<Level, 'levelId' | 'status'>[]> {
  const ai = getAiClient();
  const prompt = `
      You are an AI education assistant adding content to an existing course.
      The course is titled: "${courseTitle}".
      It already contains the following levels/modules: ${existingLevelTitles.join(', ')}.

      Based on the NEW text and images provided, your task is to:
      1.  Generate 2 new, distinct levels that complement the existing course. DO NOT repeat topics from the existing levels.
      2.  For each new level, provide:
          a. A concise, descriptive title.
          b. A detailed summary of the key concepts for that level.
          c. A multiple-choice quiz with 3 questions (4 options each).
          d. Suggestions for reference material: 2 online articles and 1 educational video.
      3. For EACH new level, identify the single most relevant image from the new set provided. Provide its 0-based index. If no image is relevant, use -1.
      4. For EACH quiz question, if it refers to one of the new images, provide that image's 0-based index.

      The response must be a single, valid JSON object containing an array of the new levels, strictly adhering to the schema.

      New Text: """${newText}"""
  `;

  const levelSchema = {
    type: Type.OBJECT,
    properties: {
      levelTitle: { type: Type.STRING },
      summary: { type: Type.STRING },
      imageIndex: { type: Type.NUMBER },
      quiz: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            answer: { type: Type.STRING },
            imageIndex: { type: Type.NUMBER }
          },
          required: ["question", "options", "answer"]
        }
      },
      references: {
        type: Type.OBJECT,
        properties: {
          articles: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, url: { type: Type.STRING }, concept: { type: Type.STRING } }, required: ["title", "url", "concept"] } },
          videos: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, url: { type: Type.STRING }, channel: { type: Type.STRING } }, required: ["title", "url", "channel"] } },
        },
        required: ["articles", "videos"]
      }
    },
    required: ["levelTitle", "summary", "quiz", "references", "imageIndex"]
  };
  
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      newLevels: {
        type: Type.ARRAY,
        items: levelSchema
      }
    },
    required: ["newLevels"]
  };
  
  try {
    const contents: Part[] = [{ text: prompt }];
    if (newImages.length > 0) {
      newImages.forEach(img => contents.push(fileToGenerativePart(img)));
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: { parts: contents },
      config: { responseMimeType: "application/json", responseSchema: responseSchema },
    });
    
    const parsedResponse = JSON.parse(response.text.trim());
    
    return parsedResponse.newLevels.map((level: any, index: number) => {
      const quizQuestions: QuizQuestion[] = level.quiz.map((q: any) => ({
        question: q.question,
        options: q.options,
        answer: q.answer,
        imageUrl: (q.imageIndex >= 0 && q.imageIndex < newImages.length) ? newImages[q.imageIndex] : undefined,
      }));

      return {
        levelTitle: level.levelTitle,
        summary: level.summary,
        imageUrl: (level.imageIndex >= 0 && level.imageIndex < newImages.length) ? newImages[level.imageIndex] : undefined,
        quizzes: [{
          quizId: `quiz-${Date.now()}-ext-${index}`,
          questions: quizQuestions,
          status: 'not-started',
        }],
        references: { ...level.references, caseStudies: [] }
      };
    });

  } catch(e) {
      console.error("Error generating additional levels:", e);
      throw new Error("Failed to generate new levels from the provided PDF.");
  }
}
