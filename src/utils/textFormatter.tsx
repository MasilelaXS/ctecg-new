/**
 * WhatsApp-style text formatting utility for React Native
 * Supports: Bold, Italic, Strikethrough, Bullet lists, Numbered lists, Options, Emojis
 */

import React from 'react';
import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';

export interface FormattedSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  code?: boolean;
}

export interface FormattedLine {
  segments: FormattedSegment[];
  type: 'text' | 'bullet' | 'numbered' | 'option';
  indent?: number;
  number?: number;
  optionText?: string;
}

export interface ParseOptions {
  allowOptions?: boolean; // Only true for admin messages
}

/**
 * Parse WhatsApp-style formatted text
 */
export function parseFormattedText(text: string, options?: ParseOptions): FormattedLine[] {
  const lines = text.split('\n');
  const result: FormattedLine[] = [];
  const { allowOptions = false } = options || {};

  lines.forEach((line) => {
    // Check for option (> followed by text) - Only for admin messages
    const optionMatch = line.match(/^(\s*)>\s+(.*)$/);
    if (allowOptions && optionMatch && optionMatch[2].trim()) {
      const content = optionMatch[2];
      result.push({
        segments: parseInlineFormatting(content),
        type: 'option',
        optionText: content,
      });
      return;
    }

    // Check for bullet point (*, •, or - followed by space and content)
    const bulletMatch = line.match(/^(\s*)[*•-]\s+(.*)$/);
    if (bulletMatch && bulletMatch[2].trim()) {
      const indent = bulletMatch[1].length;
      const content = bulletMatch[2];
      result.push({
        segments: parseInlineFormatting(content),
        type: 'bullet',
        indent,
      });
      return;
    }

    // Check for numbered list
    const numberedMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      const indent = numberedMatch[1].length;
      const number = parseInt(numberedMatch[2]);
      const content = numberedMatch[3];
      result.push({
        segments: parseInlineFormatting(content),
        type: 'numbered',
        indent,
        number,
      });
      return;
    }

    // Regular text line
    result.push({
      segments: parseInlineFormatting(line),
      type: 'text',
    });
  });

  return result;
}

/**
 * Parse inline formatting
 */
function parseInlineFormatting(text: string): FormattedSegment[] {
  const segments: FormattedSegment[] = [];
  let currentPos = 0;

  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(__[^_]+__)|(_[^_]+_)|(~[^~]+~)/g;

  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > currentPos) {
      segments.push({
        text: text.substring(currentPos, match.index),
      });
    }

    const matched = match[0];
    
    if (matched.startsWith('`') && matched.endsWith('`')) {
      segments.push({
        text: matched.slice(1, -1),
        code: true,
      });
    } else if (matched.startsWith('**') && matched.endsWith('**')) {
      segments.push({
        text: matched.slice(2, -2),
        bold: true,
      });
    } else if (matched.startsWith('*') && matched.endsWith('*')) {
      segments.push({
        text: matched.slice(1, -1),
        bold: true,
      });
    } else if (matched.startsWith('__') && matched.endsWith('__')) {
      segments.push({
        text: matched.slice(2, -2),
        italic: true,
      });
    } else if (matched.startsWith('_') && matched.endsWith('_')) {
      segments.push({
        text: matched.slice(1, -1),
        italic: true,
      });
    } else if (matched.startsWith('~') && matched.endsWith('~')) {
      segments.push({
        text: matched.slice(1, -1),
        strikethrough: true,
      });
    }

    currentPos = match.index + matched.length;
  }

  if (currentPos < text.length) {
    segments.push({
      text: text.substring(currentPos),
    });
  }

  return segments.length > 0 ? segments : [{ text }];
}

interface RenderOptions {
  baseStyle?: any;
  boldStyle?: any;
  italicStyle?: any;
  strikethroughStyle?: any;
  codeStyle?: any;
  color?: string;
  onOptionPress?: (optionText: string) => void;
  allowOptions?: boolean; // Only true for admin messages
}

/**
 * Render formatted text as React Native components
 */
export function renderFormattedText(
  text: string,
  options: RenderOptions = {}
): React.ReactElement {
  const lines = parseFormattedText(text, { allowOptions: options.allowOptions });
  const { baseStyle, boldStyle, italicStyle, strikethroughStyle, codeStyle, color, onOptionPress } = options;

  const renderLineContent = (line: FormattedLine) => line.segments.map((segment, segIndex) => {
    const styles: any[] = [baseStyle];
    if (color) styles.push({ color });

    if (segment.bold) styles.push(boldStyle || { fontWeight: '700' });
    if (segment.italic) styles.push(italicStyle || { fontStyle: 'italic' });
    if (segment.strikethrough) styles.push(strikethroughStyle || { textDecorationLine: 'line-through' });
    if (segment.code) styles.push(codeStyle || formattingStyles.code);

    return (
      <Text key={segIndex} style={styles}>
        {segment.text}
      </Text>
    );
  });

  const nodes: React.ReactNode[] = [];
  let optionBuffer: FormattedLine[] = [];
  let optionGroupIndex = 0;

  const flushOptionBuffer = () => {
    if (optionBuffer.length === 0) {
      return;
    }

    const group = optionBuffer;
    optionBuffer = [];

    nodes.push(
      <View key={`option-group-${optionGroupIndex++}`} style={formattingStyles.optionGroup}>
        <View style={formattingStyles.optionCard}>
        {group.map((optionLine, optionIndex) => {
          const optionText = optionLine.optionText || '';

          return (
            <TouchableOpacity
              key={`option-${optionIndex}`}
              style={[
                formattingStyles.optionRow,
                optionIndex > 0 ? formattingStyles.optionRowDivider : null,
              ]}
              onPress={() => onOptionPress && onOptionPress(optionText)}
              disabled={!onOptionPress}
            >
              <Text style={formattingStyles.optionText}>{renderLineContent(optionLine)}</Text>
            </TouchableOpacity>
          );
        })}
        </View>
      </View>
    );
  };

  lines.forEach((line, lineIndex) => {
    if (line.type === 'option') {
      optionBuffer.push(line);
      return;
    }

    flushOptionBuffer();

    const content = renderLineContent(line);

    if (line.type === 'bullet') {
      nodes.push(
        <View key={`line-${lineIndex}`} style={[formattingStyles.listItem, { paddingLeft: (line.indent || 0) * 16 }]}>
          <Text style={[baseStyle, { color }]}>• </Text>
          <Text style={[baseStyle, { color, flex: 1 }]}>{content}</Text>
        </View>
      );
      return;
    }

    if (line.type === 'numbered') {
      nodes.push(
        <View key={`line-${lineIndex}`} style={[formattingStyles.listItem, { paddingLeft: (line.indent || 0) * 16 }]}>
          <Text style={[baseStyle, { color }]}>{line.number}. </Text>
          <Text style={[baseStyle, { color, flex: 1 }]}>{content}</Text>
        </View>
      );
      return;
    }

    nodes.push(
      <Text key={`line-${lineIndex}`} style={[baseStyle, { color }]}>
        {content}
        {lineIndex < lines.length - 1 && '\n'}
      </Text>
    );
  });

  flushOptionBuffer();

  return <>{nodes}</>;
}

const formattingStyles = StyleSheet.create({
  listItem: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  code: {
    fontFamily: 'monospace',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: 13,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: '#B7CCF9',
    backgroundColor: '#F7FAFF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginVertical: 4,
    width: '100%',
    alignItems: 'center',
  },
  optionGroup: {
    flexDirection: 'column',
    marginTop: 4,
    marginBottom: 4,
  },
  optionCard: {
    borderWidth: 1,
    borderColor: '#D9E4FF',
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    overflow: 'hidden',
  },
  optionRow: {
    width: '100%',
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  optionRowDivider: {
    borderTopWidth: 1,
    borderTopColor: '#E8EEFF',
  },
  optionText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'left',
    width: '100%',
  },
});
