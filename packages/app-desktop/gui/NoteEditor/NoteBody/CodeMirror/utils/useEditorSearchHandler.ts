import { RefObject, useEffect, useMemo, useRef } from 'react';
import usePrevious from '../../../../hooks/usePrevious';
import { RenderedBody } from './types';
import { SearchMarkers } from '../../../utils/useSearchMarkers';
const debounce = require('debounce');

import { EditorCommandType } from '@joplin/editor/types';

interface Props {
	setLocalSearchResultCount(count: number): void;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Old code before rule was applied
	searchMarkers: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Old code before rule was applied
	webviewRef: RefObject<any>;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Old code before rule was applied
	editorRef: RefObject<any>;

	noteContent: string;
	renderedBody: RenderedBody;
	showEditorMarkers: boolean;
}

const useEditorSearchHandler = (props: Props) => {
	const {
		webviewRef, editorRef, renderedBody, noteContent, searchMarkers, showEditorMarkers,
	} = props;

	const previousContent = usePrevious(noteContent);
	const previousRenderedBody = usePrevious(renderedBody);
	const previousSearchMarkers = usePrevious(searchMarkers);
	const showEditorMarkersRef = useRef(showEditorMarkers);
	showEditorMarkersRef.current = showEditorMarkers;

	// Fixes https://github.com/laurent22/joplin/issues/7565
	const debouncedMarkers = useMemo(() => debounce((searchMarkers: SearchMarkers) => {
		if (!editorRef.current) return;
		if (showEditorMarkersRef.current) {
			const matches = editorRef.current.setMarkers(searchMarkers.keywords, searchMarkers.options);
			props.setLocalSearchResultCount(matches);
		} else {
			editorRef.current.setMarkers(searchMarkers.keywords, { ...searchMarkers.options, showEditorMarkers: false });
		}

		const viewDom = editorRef.current.editor.dom;
		const panel = viewDom.querySelector('.cm-panel.cm-search');
		const input = panel?.querySelector('input.cm-textfield, textarea.cm-textfield');

		const selStart = input?.selectionStart ?? null;
		const selEnd = input?.selectionEnd ?? null;
		const scrollL = input?.scrollLeft ?? 0;

		if (searchMarkers.keywords[0].value && !showEditorMarkersRef.current) {
			editorRef.current.execCommand(EditorCommandType.FindNext);
		}

		if (input) {
			requestAnimationFrame(() => requestAnimationFrame(() => {
				if (selStart !== null && selEnd !== null) {
					const max = input.value.length;
					const s = Math.min(selStart, max);
					const e = Math.min(selEnd, max);
					input.setSelectionRange(s, e);
					input.scrollLeft = scrollL;
				} else {
					const end = input.value.length;
					input.setSelectionRange(end, end);
				}
			}));
		}

	}, 50), [editorRef, props.setLocalSearchResultCount]);

	useEffect(() => {
		if (!searchMarkers) return () => { };

		// If there is a currently active search, it's important to re-search the text as the user
		// types. However this is slow for performance so we ONLY want it to happen when there is
		// a search

		// Note that since the CodeMirror component also needs to handle the viewer pane, we need
		// to check if the rendered body has changed too (it will be changed with a delay after
		// props.content has been updated).
		const textChanged = searchMarkers.keywords.length > 0 && (noteContent !== previousContent || renderedBody !== previousRenderedBody);

		if (webviewRef.current && (searchMarkers !== previousSearchMarkers || textChanged)) {
			webviewRef.current.send('setMarkers', searchMarkers.keywords, searchMarkers.options);
			debouncedMarkers(searchMarkers);
		}
		return () => { };
	}, [
		editorRef,
		webviewRef,
		searchMarkers,
		previousSearchMarkers,
		props.setLocalSearchResultCount,
		noteContent,
		previousContent,
		previousRenderedBody,
		renderedBody,
		debouncedMarkers,
	]);

};

export default useEditorSearchHandler;
