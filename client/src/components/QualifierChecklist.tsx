import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle } from "lucide-react";
import { QualifierAnswer } from "@/hooks/useCompanies";

interface QualifierChecklistProps {
  questions: string[];
  answers: QualifierAnswer[];
  onUpdate: (answers: QualifierAnswer[]) => void;
}

export default function QualifierChecklist({ questions, answers, onUpdate }: QualifierChecklistProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editAnswer, setEditAnswer] = useState("");

  const getAnswer = (question: string): QualifierAnswer | undefined => {
    return answers.find(a => a.question === question);
  };

  const handleToggle = (question: string, checked: boolean) => {
    if (checked) {
      setEditingIndex(questions.indexOf(question));
      setEditAnswer("");
    } else {
      const newAnswers = answers.filter(a => a.question !== question);
      onUpdate(newAnswers);
    }
  };

  const handleSaveAnswer = (question: string) => {
    const newAnswers = [...answers.filter(a => a.question !== question)];
    newAnswers.push({
      question,
      answer: editAnswer || null,
      answeredAt: new Date().toISOString(),
    });
    onUpdate(newAnswers);
    setEditingIndex(null);
    setEditAnswer("");
  };

  const answeredCount = answers.filter(a => a.answer).length;
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Kvalificerande Frågor</CardTitle>
          <Badge variant={progress === 100 ? "default" : "secondary"}>
            {answeredCount} / {questions.length}
          </Badge>
        </div>
        {progress > 0 && (
          <div className="w-full bg-secondary rounded-full h-2 mt-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all" 
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {questions.map((question, index) => {
          const answer = getAnswer(question);
          const isAnswered = !!answer;
          const isEditing = editingIndex === index;

          return (
            <div key={index} className="space-y-2">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={isAnswered}
                  onCheckedChange={(checked) => handleToggle(question, checked as boolean)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <p className={`text-sm ${isAnswered ? "line-through text-muted-foreground" : ""}`}>
                    {question}
                  </p>
                  {isAnswered && answer?.answer && !isEditing && (
                    <div className="mt-2 p-3 bg-muted rounded-md">
                      <p className="text-sm text-muted-foreground">{answer.answer}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Besvarad: {new Date(answer.answeredAt!).toLocaleDateString('sv-SE')}
                      </p>
                    </div>
                  )}
                  {isEditing && (
                    <div className="mt-2 space-y-2">
                      <Textarea
                        value={editAnswer}
                        onChange={(e) => setEditAnswer(e.target.value)}
                        placeholder="Skriv svaret här..."
                        className="min-h-[80px]"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleSaveAnswer(question)}>
                          Spara
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => {
                            setEditingIndex(null);
                            setEditAnswer("");
                          }}
                        >
                          Avbryt
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                {isAnswered && (
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                )}
                {!isAnswered && (
                  <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
